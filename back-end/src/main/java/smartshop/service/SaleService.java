package smartshop.service;

import smartshop.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.CheckInfo;
import smartshop.dto.SaleLineRequest;
import smartshop.dto.SaleReturnRequest;
import smartshop.dto.SaleRequest;
import smartshop.entity.Customer;
import smartshop.entity.CustomerPayment;
import smartshop.entity.CheckStatus;
import smartshop.entity.DocumentType;
import smartshop.entity.PaymentMethod;
import smartshop.entity.SaleReturn;
import smartshop.entity.SaleReturnLine;
import smartshop.entity.Product;
import smartshop.entity.Sale;
import smartshop.entity.SaleLine;
import smartshop.entity.SaleStatus;
import smartshop.entity.StockMovement;
import smartshop.entity.StockMovementType;
import smartshop.repository.CustomerPaymentRepository;
import smartshop.repository.CustomerRepository;
import smartshop.repository.ProductRepository;
import smartshop.repository.SaleRepository;
import smartshop.repository.SaleReturnRepository;
import smartshop.repository.StockMovementRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class SaleService {

    private final SaleRepository saleRepository;
    private final CustomerRepository customerRepository;
    private final CustomerPaymentRepository paymentRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;
    private final NumberingService numberingService;
    private final SaleReturnRepository saleReturnRepository;
    private final PromotionService promotionService;
    private final ApprovalService approvalService;

    public SaleService(SaleRepository saleRepository,
                       CustomerRepository customerRepository,
                       CustomerPaymentRepository paymentRepository,
                       ProductRepository productRepository,
                       StockMovementRepository stockMovementRepository,
                       NumberingService numberingService,
                       SaleReturnRepository saleReturnRepository,
                       PromotionService promotionService,
                       ApprovalService approvalService) {
        this.saleRepository = saleRepository;
        this.customerRepository = customerRepository;
        this.paymentRepository = paymentRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.numberingService = numberingService;
        this.saleReturnRepository = saleReturnRepository;
        this.promotionService = promotionService;
        this.approvalService = approvalService;
    }

    @Transactional
    public Sale create(SaleRequest request) {
        Customer customer = null;
        if (request.customerId() != null) {
            customer = customerRepository.findById(request.customerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client introuvable"));
            if (!Boolean.TRUE.equals(customer.getActive())) {
                throw new IllegalArgumentException("Ce client est désactivé");
            }
        }

        PaymentMethod method = request.paymentMethod() != null ? request.paymentMethod() : PaymentMethod.CASH;
        if (method == PaymentMethod.CHECK) {
            if (customer == null) {
                throw new IllegalArgumentException("Un paiement par chèque nécessite un client enregistré");
            }
            if (request.check() == null) {
                throw new IllegalArgumentException("Indique le numéro et l'échéance du chèque");
            }
        }

        Sale sale = new Sale();
        sale.setCustomer(customer);
        sale.setPaymentMethod(method);
        sale.setSeller(smartshop.security.CurrentUser.get().orElse(null));

        BigDecimal subtotal = BigDecimal.ZERO;
        // Valeur "prix catalogue" (promotions comprises) : sert à mesurer la remise réelle accordée
        BigDecimal catalogValue = BigDecimal.ZERO;
        var running = promotionService.running();

        for (SaleLineRequest lineRequest : request.lines()) {
            Product product = productRepository.findById(lineRequest.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
            if (!product.getActive()) {
                throw new IllegalArgumentException(
                        "Le produit " + product.getName() + " est désactivé");
            }

            boolean byPack = Boolean.TRUE.equals(lineRequest.packs());
            if (byPack && product.getUnitsPerPack() == null) {
                throw new IllegalArgumentException("Le produit " + product.getName() + " n'a pas de conditionnement en carton");
            }
            int units = byPack ? lineRequest.quantity() * product.getUnitsPerPack() : lineRequest.quantity();

            SaleLine line = new SaleLine();
            line.setProduct(product);
            line.setQuantity(units);
            if (byPack) {
                BigDecimal packPrice = lineRequest.unitPrice() != null ? lineRequest.unitPrice() : product.getEffectivePackPrice();
                line.setPackCount(lineRequest.quantity());
                line.setPackPrice(packPrice);
                line.setUnitPrice(packPrice.divide(BigDecimal.valueOf(product.getUnitsPerPack()), 2, RoundingMode.HALF_UP));
            } else {
                BigDecimal promoPrice = PromotionService.lineUnitPrice(product, promotionService.bestOffer(product, running), units);
                line.setUnitPrice(lineRequest.unitPrice() != null ? lineRequest.unitPrice() : promoPrice);
                catalogValue = catalogValue.add(promoPrice.multiply(BigDecimal.valueOf(units)));
            }
            if (byPack) catalogValue = catalogValue.add(product.getEffectivePackPrice().multiply(BigDecimal.valueOf(lineRequest.quantity())));
            // On garde le coût du moment : le bénéfice de cette vente ne changera plus
            line.setUnitCost(product.getAveragePurchasePrice());
            sale.addLine(line);

            subtotal = subtotal.add(line.getLineTotal());

            // Le stock peut devenir négatif : la vente reste autorisée
            product.setStockQuantity(product.getStockQuantity() - units);
            productRepository.save(product);
        }

        // Remise en % prioritaire : convertie en DH sur le sous-total
        BigDecimal discount = request.discountPercent() != null
                ? subtotal.multiply(request.discountPercent()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : request.discount() != null ? request.discount() : BigDecimal.ZERO;
        if (discount.compareTo(subtotal) > 0) {
            throw new IllegalArgumentException(
                    "La remise dépasse le total de la vente (" + subtotal + " DH)");
        }
        BigDecimal total = subtotal.subtract(discount);
        approvalService.checkDiscount(catalogValue, total, request.approvalPin());

        // Par défaut, la vente est payée en entier
        BigDecimal paid = request.amountPaid() != null ? request.amountPaid() : total;
        if (paid.compareTo(total) > 0) {
            throw new IllegalArgumentException(
                    "Le montant payé dépasse le total de la vente (" + total + " DH)");
        }

        BigDecimal credit = total.subtract(paid);
        if (credit.signum() > 0) {
            if (customer == null) {
                throw new IllegalArgumentException("Une vente à crédit (kridi) nécessite un client");
            }
            checkCreditLimit(customer, credit);
        }

        sale.setDiscount(discount);
        sale.setDiscountPercent(request.discountPercent());
        sale.setNumber(numberingService.next(DocumentType.SALE));
        sale.setTotal(total);
        sale.setAmountPaid(paid);

        Sale saved = saleRepository.save(sale);

        // Mouvements de stock (après la sauvegarde pour avoir l'id de la vente)
        for (SaleLine line : saved.getLines()) {
            StockMovement movement = new StockMovement();
            movement.setProduct(line.getProduct());
            movement.setType(StockMovementType.SALE);
            movement.setQuantity(-line.getQuantity());
            movement.setReferenceId(saved.getId());
            stockMovementRepository.save(movement);
        }

        // Argent encaissé tout de suite par un client enregistré : on le garde dans l'historique
        if (customer != null && paid.signum() > 0) {
            CustomerPayment payment = newPayment(customer, saved, paid, method, request.check(), UUID.randomUUID());
            paymentRepository.save(payment);
        }

        return saved;
    }

    @Transactional
    public Sale cancel(UUID saleId, String reason, String approvalPin) {
        approvalService.checkCancellation(approvalPin);
        Sale sale = findById(saleId);

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new IllegalArgumentException("Cette vente est déjà annulée");
        }
        if (!sale.getReturns().isEmpty()) {
            throw new IllegalArgumentException("Cette vente a des retours : elle ne peut plus être annulée");
        }

        // On remet les articles en stock
        for (SaleLine line : sale.getLines()) {
            Product product = line.getProduct();
            product.setStockQuantity(product.getStockQuantity() + line.getQuantity());
            productRepository.save(product);

            StockMovement movement = new StockMovement();
            movement.setProduct(product);
            movement.setType(StockMovementType.SALE_CANCELLATION);
            movement.setQuantity(line.getQuantity());
            movement.setReferenceId(sale.getId());
            movement.setNote(reason);
            stockMovementRepository.save(movement);
        }

        sale.setStatus(SaleStatus.CANCELLED);
        sale.setCancelledAt(LocalDateTime.now());
        sale.setCancellationReason(reason);
        return saleRepository.save(sale);
    }

    /**
     * Retour d'articles : remise en stock (sauf articles abîmés), avoir déduit de la dette,
     * et remboursement de la différence si le client avait déjà payé plus que le nouveau total.
     */
    @Transactional
    public Sale createReturn(UUID saleId, SaleReturnRequest request) {
        Sale sale = findById(saleId);
        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new IllegalArgumentException("Impossible de retourner les articles d'une vente annulée");
        }

        // La remise de la vente est répartie au prorata sur les articles repris
        BigDecimal subtotal = sale.getTotal().add(sale.getDiscount());
        BigDecimal ratio = subtotal.signum() == 0 ? BigDecimal.ONE : sale.getTotal().divide(subtotal, 10, RoundingMode.HALF_UP);

        SaleReturn saleReturn = new SaleReturn();
        saleReturn.setSale(sale);
        saleReturn.setReason(request.reason() != null && !request.reason().isBlank() ? request.reason().trim() : null);
        BigDecimal gross = BigDecimal.ZERO;

        for (SaleReturnRequest.Line lineRequest : request.lines()) {
            SaleLine sold = sale.getLines().stream()
                    .filter(l -> l.getProduct().getId().equals(lineRequest.productId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Ce produit ne fait pas partie de la vente"));
            int soldQuantity = sale.getLines().stream()
                    .filter(l -> l.getProduct().getId().equals(lineRequest.productId()))
                    .mapToInt(SaleLine::getQuantity).sum();
            int alreadyReturned = sale.getReturnedQuantity(lineRequest.productId());
            if (lineRequest.quantity() > soldQuantity - alreadyReturned) {
                throw new IllegalArgumentException("Quantité retournée trop grande pour " + sold.getProduct().getName()
                        + " (encore retournable : " + (soldQuantity - alreadyReturned) + ")");
            }

            boolean restock = lineRequest.restock() == null || lineRequest.restock();
            SaleReturnLine line = new SaleReturnLine();
            line.setProduct(sold.getProduct());
            line.setQuantity(lineRequest.quantity());
            line.setUnitPrice(sold.getUnitPrice());
            line.setUnitCost(sold.getUnitCost());
            line.setRestocked(restock);
            saleReturn.addLine(line);
            gross = gross.add(sold.getUnitPrice().multiply(BigDecimal.valueOf(lineRequest.quantity())));

            if (restock) {
                Product product = sold.getProduct();
                product.setStockQuantity(product.getStockQuantity() + lineRequest.quantity());
                productRepository.save(product);
            }
        }

        BigDecimal credit = gross.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
        BigDecimal debtBefore = sale.getRemaining();
        // Ce que le client a payé en trop après le retour lui est rendu
        BigDecimal refund = credit.subtract(debtBefore.max(BigDecimal.ZERO)).max(BigDecimal.ZERO);
        saleReturn.setCreditAmount(credit);
        saleReturn.setRefundAmount(refund);
        saleReturn.setRefundMethod(refund.signum() > 0 ? (request.refundMethod() != null ? request.refundMethod() : PaymentMethod.CASH) : null);

        sale.setReturnedAmount(sale.getReturnedAmount().add(credit));
        sale.setRefundedAmount(sale.getRefundedAmount().add(refund));
        SaleReturn saved = saleReturnRepository.save(saleReturn);
        sale.getReturns().add(saved);
        saleRepository.save(sale);

        for (SaleReturnLine line : saved.getLines()) {
            if (!line.getRestocked()) continue;
            StockMovement movement = new StockMovement();
            movement.setProduct(line.getProduct());
            movement.setType(StockMovementType.SALE_RETURN);
            movement.setQuantity(line.getQuantity());
            movement.setReferenceId(sale.getId());
            movement.setNote(saved.getReason());
            stockMovementRepository.save(movement);
        }
        return sale;
    }

    /** Crée une ligne de paiement ; un chèque démarre "en attente" jusqu'à son encaissement. */
    static CustomerPayment newPayment(Customer customer, Sale sale, BigDecimal amount, PaymentMethod method, CheckInfo check, UUID operationId) {
        CustomerPayment payment = new CustomerPayment();
        payment.setCustomer(customer);
        payment.setSale(sale);
        payment.setAmount(amount);
        payment.setMethod(method);
        payment.setOperationId(operationId);
        payment.setCollectedBy(smartshop.security.CurrentUser.get().orElse(null));
        if (method == PaymentMethod.CHECK && check != null) {
            payment.setCheckNumber(check.number().trim());
            payment.setCheckBank(check.bank() != null && !check.bank().isBlank() ? check.bank().trim() : null);
            payment.setCheckDueDate(check.dueDate());
            payment.setCheckStatus(CheckStatus.PENDING);
        }
        return payment;
    }

    /** Émet la facture de la vente (une seule fois : le même numéro est renvoyé ensuite). */
    @Transactional
    public Sale issueInvoice(UUID saleId) {
        Sale sale = findById(saleId);
        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new IllegalArgumentException("Impossible de facturer une vente annulée");
        }
        if (sale.getInvoiceNumber() == null) {
            sale.setInvoiceNumber(numberingService.next(DocumentType.INVOICE));
            sale.setInvoiceDate(LocalDateTime.now());
            sale.setVerificationCode(newVerificationCode());
            saleRepository.save(sale);
        }
        return sale;
    }

    // 20 caractères non devinables (A-Z, 2-9 sans caractères ambigus)
    private static String newVerificationCode() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 20; i++) code.append(alphabet.charAt(random.nextInt(alphabet.length())));
        return code.toString();
    }

    /** Retrouve une facture par son code de vérification (page publique). */
    @Transactional(readOnly = true)
    public java.util.Optional<Sale> findByVerificationCode(String code) {
        return saleRepository.findByVerificationCode(code);
    }

    /** Émet le bon de livraison de la vente (une seule fois). */
    @Transactional
    public Sale issueDeliveryNote(UUID saleId) {
        Sale sale = findById(saleId);
        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new IllegalArgumentException("Impossible de livrer une vente annulée");
        }
        if (sale.getDeliveryNumber() == null) {
            sale.setDeliveryNumber(numberingService.next(DocumentType.DELIVERY_NOTE));
            saleRepository.save(sale);
        }
        return sale;
    }

    @Transactional(readOnly = true)
    public Sale findById(UUID id) {
        return saleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vente introuvable"));
    }

    @Transactional(readOnly = true)
    public List<Sale> findAll() {
        return saleRepository.findAllByOrderBySaleDateDesc();
    }

    @Transactional(readOnly = true)
    public List<Sale> findRecent(int limit) {
        return saleRepository.findAllByOrderBySaleDateDesc(org.springframework.data.domain.PageRequest.of(0, Math.min(Math.max(limit, 1), 200)));
    }

    private void checkCreditLimit(Customer customer, BigDecimal newCredit) {
        BigDecimal limit = customer.getCreditLimit();
        if (limit == null) {
            return;
        }
        BigDecimal current = saleRepository.sumDebtByCustomer(customer.getId());
        if (current == null) {
            current = BigDecimal.ZERO;
        }
        if (current.add(newCredit).compareTo(limit) > 0) {
            throw new IllegalArgumentException(
                    "Limite de kridi dépassée : dette actuelle " + current
                            + " DH, limite " + limit + " DH");
        }
    }
}
