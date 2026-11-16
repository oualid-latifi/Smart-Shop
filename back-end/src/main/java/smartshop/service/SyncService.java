package smartshop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import smartshop.dto.CustomerRequest;
import smartshop.dto.CustomerResponse;
import smartshop.dto.PaymentRequest;
import smartshop.dto.ProductResponse;
import smartshop.dto.SaleRequest;
import smartshop.dto.SaleResponse;
import smartshop.dto.ShopSettingsDto;
import smartshop.entity.AppUser;
import smartshop.entity.Customer;
import smartshop.entity.Permission;
import smartshop.entity.Product;
import smartshop.entity.Promotion;
import smartshop.entity.Sale;
import smartshop.entity.SyncOperation;
import smartshop.repository.CustomerRepository;
import smartshop.repository.ProductRepository;
import smartshop.repository.SaleRepository;
import smartshop.repository.SyncOperationRepository;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Synchronisation bidirectionnelle téléphone ↔ serveur.
 * <ul>
 *   <li><b>pull</b> : ce qui a changé sur le serveur depuis la dernière synchronisation du téléphone
 *       (produits, clients, ventes, paramètres). Une marge de 2 minutes évite de manquer une modification
 *       enregistrée pendant la synchronisation : le téléphone remplace simplement les lignes reçues en double.</li>
 *   <li><b>push</b> : les opérations faites hors-ligne, appliquées dans l'ordre, chacune dans sa propre
 *       transaction et une seule fois grâce à son identifiant (table sync_operations).</li>
 * </ul>
 */
@Service
public class SyncService {

    private static final long OVERLAP_MINUTES = 2;
    private static final int FIRST_SYNC_SALE_DAYS = 30;
    private static final int MAX_OPS = 100;

    public record PullResponse(LocalDateTime cursor, String promoKey, boolean full,
                               List<ProductResponse> products, List<CustomerResponse> customers,
                               List<SaleResponse> sales, ShopSettingsDto settings) {
    }

    /** opId créé par le téléphone ; customerOpId : client créé hors-ligne par une opération précédente. */
    public record Operation(String opId, SyncOperation.Type type, JsonNode payload, String customerOpId, LocalDateTime occurredAt) {
    }

    public enum Status { OK, DUPLICATE, ERROR }

    public record OperationResult(String opId, Status status, UUID resultId, String number, String message) {
    }

    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final SaleRepository saleRepository;
    private final SyncOperationRepository operationRepository;
    private final PromotionService promotionService;
    private final CustomerService customerService;
    private final SaleService saleService;
    private final ShopSettingsService settingsService;
    private final ObjectMapper json;
    private final Validator validator;
    private final TransactionTemplate newTransaction;

    public SyncService(ProductRepository productRepository, CustomerRepository customerRepository, SaleRepository saleRepository,
                       SyncOperationRepository operationRepository, PromotionService promotionService,
                       CustomerService customerService, SaleService saleService, ShopSettingsService settingsService,
                       ObjectMapper json, Validator validator, PlatformTransactionManager transactionManager) {
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.saleRepository = saleRepository;
        this.operationRepository = operationRepository;
        this.promotionService = promotionService;
        this.customerService = customerService;
        this.saleService = saleService;
        this.settingsService = settingsService;
        this.json = json;
        this.validator = validator;
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ---------------------------------------------------------------- Serveur -> téléphone

    @Transactional(readOnly = true)
    public PullResponse pull(AppUser user, LocalDateTime since, String clientPromoKey) {
        LocalDateTime cursor = LocalDateTime.now();
        LocalDateTime from = since == null ? null : since.minusMinutes(OVERLAP_MINUTES);
        Set<Permission> perms = user.getRole().getPermissions();

        // Les prix promo dépendent des promotions en cours : si elles ont changé, tout le catalogue est renvoyé
        List<Promotion> running = promotionService.running();
        String promoKey = promoKey(running);
        boolean full = from == null || !promoKey.equals(clientPromoKey);
        List<Product> products = full ? productRepository.findAll() : productRepository.findByUpdatedAtAfter(from);
        List<ProductResponse> productDtos = products.stream()
                .map(p -> ProductResponse.from(p, promotionService.bestOffer(p, running)))
                .toList();

        List<CustomerResponse> customers = List.of();
        if (perms.contains(Permission.CUSTOMERS) || perms.contains(Permission.PAYMENTS)) {
            List<Customer> changed = from == null ? customerRepository.findAll() : customerRepository.findChangedSince(from);
            customers = changed.stream().map(c -> customerService.findById(c.getId())).toList();
        }

        List<SaleResponse> sales = List.of();
        if (perms.contains(Permission.SALES) || perms.contains(Permission.PAYMENTS) || perms.contains(Permission.REPORTS)) {
            List<Sale> changed = from == null
                    ? saleRepository.findTop500BySaleDateAfterOrderBySaleDateDesc(cursor.minusDays(FIRST_SYNC_SALE_DAYS))
                    : saleRepository.findTop500ByUpdatedAtAfterOrderByUpdatedAtAsc(from);
            sales = changed.stream().map(SaleResponse::from).toList();
        }

        return new PullResponse(cursor, promoKey, full, productDtos, customers, sales, ShopSettingsDto.from(settingsService.get()));
    }

    private static String promoKey(List<Promotion> running) {
        return running.stream()
                .sorted(Comparator.comparing(p -> p.getId().toString()))
                .map(p -> p.getId() + ":" + p.getKind() + ":" + p.getValue().stripTrailingZeros().toPlainString()
                        + ":" + (p.getProduct() != null ? p.getProduct().getId() : null) + ":" + p.getBrand() + ":" + p.getEndsOn())
                .collect(Collectors.joining("|"))
                .hashCode() + "-" + running.size();
    }

    // ---------------------------------------------------------------- Téléphone -> serveur

    public List<OperationResult> push(AppUser user, List<Operation> operations) {
        if (operations.size() > MAX_OPS) throw new IllegalArgumentException("Au plus " + MAX_OPS + " opérations par envoi");
        List<OperationResult> results = new ArrayList<>();
        for (Operation op : operations) results.add(apply(user, op));
        return results;
    }

    private OperationResult apply(AppUser user, Operation op) {
        if (op.opId() == null || !op.opId().matches("[A-Za-z0-9_-]{6,40}") || op.type() == null || op.payload() == null) {
            return new OperationResult(op.opId(), Status.ERROR, null, null, "Opération invalide");
        }
        var done = operationRepository.findById(op.opId());
        if (done.isPresent()) return duplicate(done.get());
        try {
            return newTransaction.execute(status -> switch (op.type()) {
                case CUSTOMER_CREATE -> createCustomer(user, op);
                case SALE_CREATE -> createSale(user, op);
                case PAYMENT_CREATE -> createPayment(user, op);
            });
        } catch (DataIntegrityViolationException e) {
            // Même opération reçue en parallèle (deux envois simultanés) : déjà enregistrée par l'autre
            return operationRepository.findById(op.opId()).map(this::duplicate)
                    .orElse(new OperationResult(op.opId(), Status.ERROR, null, null, "Donnée en conflit avec le serveur"));
        } catch (RuntimeException e) {
            String message = e.getMessage() != null ? e.getMessage() : "Opération refusée";
            return new OperationResult(op.opId(), Status.ERROR, null, null, message);
        }
    }

    private OperationResult duplicate(SyncOperation done) {
        String number = done.getType() == SyncOperation.Type.SALE_CREATE && done.getResultId() != null
                ? saleRepository.findById(done.getResultId()).map(Sale::getNumber).orElse(null) : null;
        return new OperationResult(done.getOpId(), Status.DUPLICATE, done.getResultId(), number, null);
    }

    private OperationResult createCustomer(AppUser user, Operation op) {
        require(user, Permission.CUSTOMERS);
        CustomerRequest request = read(op.payload(), CustomerRequest.class);
        CustomerResponse created = customerService.create(request);
        operationRepository.save(new SyncOperation(op.opId(), op.type(), created.id(), user.getId()));
        return new OperationResult(op.opId(), Status.OK, created.id(), null, null);
    }

    private OperationResult createSale(AppUser user, Operation op) {
        require(user, Permission.SALES);
        SaleRequest r = read(op.payload(), SaleRequest.class);
        UUID customerId = resolveCustomer(r.customerId(), op.customerOpId());
        // clientRef = opId : une vente déjà reçue par l'ancienne file hors-ligne n'est pas recréée
        SaleRequest request = new SaleRequest(customerId, r.discount(), r.discountPercent(), r.amountPaid(), r.paymentMethod(),
                r.check(), r.lines(), r.approvalPin(), op.opId());
        Sale sale = saleService.create(request);
        // Heure réelle de la vente faite hors-ligne (jamais dans le futur, au plus 30 jours en arrière)
        LocalDateTime now = LocalDateTime.now();
        if (op.occurredAt() != null && op.occurredAt().isBefore(now) && op.occurredAt().isAfter(now.minusDays(30))
                && ChronoUnit.SECONDS.between(sale.getSaleDate(), now) < 60) {
            sale.setSaleDate(op.occurredAt());
            saleRepository.save(sale);
        }
        operationRepository.save(new SyncOperation(op.opId(), op.type(), sale.getId(), user.getId()));
        return new OperationResult(op.opId(), Status.OK, sale.getId(), sale.getNumber(), null);
    }

    private OperationResult createPayment(AppUser user, Operation op) {
        require(user, Permission.PAYMENTS);
        UUID customerId = resolveCustomer(op.payload().hasNonNull("customerId") ? UUID.fromString(op.payload().get("customerId").asText()) : null,
                op.customerOpId());
        if (customerId == null) throw new IllegalArgumentException("Client du paiement manquant");
        customerService.pay(customerId, read(op.payload(), PaymentRequest.class));
        operationRepository.save(new SyncOperation(op.opId(), op.type(), customerId, user.getId()));
        return new OperationResult(op.opId(), Status.OK, customerId, null, null);
    }

    /** Client déjà connu du serveur, ou créé hors-ligne par une opération envoyée avant celle-ci. */
    private UUID resolveCustomer(UUID customerId, String customerOpId) {
        if (customerOpId == null || customerOpId.isBlank()) return customerId;
        return operationRepository.findById(customerOpId)
                .filter(o -> o.getType() == SyncOperation.Type.CUSTOMER_CREATE)
                .map(SyncOperation::getResultId)
                .orElseThrow(() -> new IllegalArgumentException("Le client de cette opération n'a pas encore été enregistré"));
    }

    private <T> T read(JsonNode payload, Class<T> type) {
        T value;
        try {
            value = json.treeToValue(payload, type);
        } catch (Exception e) {
            throw new IllegalArgumentException("Données illisibles");
        }
        Set<ConstraintViolation<T>> violations = validator.validate(value);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException(violations.stream()
                    .map(v -> v.getPropertyPath() + " : " + v.getMessage()).sorted().collect(Collectors.joining(", ")));
        }
        return value;
    }

    private static void require(AppUser user, Permission permission) {
        if (!user.getRole().getPermissions().contains(permission)) {
            throw new IllegalArgumentException("Ton compte n'a pas le droit de faire cette opération");
        }
    }
}
