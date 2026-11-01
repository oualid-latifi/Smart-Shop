package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.SaleLineRequest;
import smartshop.dto.SaleRequest;
import smartshop.entity.Customer;
import smartshop.entity.CustomerPayment;
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
import smartshop.repository.StockMovementRepository;

import java.math.BigDecimal;
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

    public SaleService(SaleRepository saleRepository,
                       CustomerRepository customerRepository,
                       CustomerPaymentRepository paymentRepository,
                       ProductRepository productRepository,
                       StockMovementRepository stockMovementRepository) {
        this.saleRepository = saleRepository;
        this.customerRepository = customerRepository;
        this.paymentRepository = paymentRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    @Transactional
    public Sale create(SaleRequest request) {
        // A mobile operation keeps the same UUID when retried after a network failure.
        if (request.id() != null) {
            Sale existing = saleRepository.findByIdForUpdate(request.id()).orElse(null);
            if (existing != null) return existing;
        }

        Customer customer = null;
        if (request.customerId() != null) {
            customer = customerRepository.findByIdForUpdate(request.customerId())
                    .orElseThrow(() -> new IllegalArgumentException("Client introuvable"));
        }

        Sale sale = new Sale();
        if (request.id() != null) sale.setId(request.id());
        sale.setCustomer(customer);

        BigDecimal subtotal = BigDecimal.ZERO;

        for (SaleLineRequest lineRequest : request.lines()) {
            Product product = productRepository.findByIdForUpdate(lineRequest.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
            if (!product.getActive()) {
                throw new IllegalArgumentException(
                        "Le produit " + product.getName() + " est désactivé");
            }

            BigDecimal unitPrice = lineRequest.unitPrice() != null
                    ? lineRequest.unitPrice()
                    : product.getSalePrice();

            if (lineRequest.quantity() > product.getStockQuantity()) {
                throw new IllegalArgumentException("Stock insuffisant pour " + product.getName()
                        + " : disponible " + product.getStockQuantity()
                        + ", demandé " + lineRequest.quantity());
            }

            SaleLine line = new SaleLine();
            line.setProduct(product);
            line.setQuantity(lineRequest.quantity());
            line.setUnitPrice(unitPrice);
            // On garde le coût du moment : le bénéfice de cette vente ne changera plus
            line.setUnitCost(product.getAveragePurchasePrice());
            sale.addLine(line);

            subtotal = subtotal.add(unitPrice.multiply(BigDecimal.valueOf(lineRequest.quantity())));

            // Le stock est vérifié et verrouillé avant toute décrémentation.
            product.setStockQuantity(product.getStockQuantity() - lineRequest.quantity());
            productRepository.save(product);
        }

        BigDecimal discount = request.discount() != null ? request.discount() : BigDecimal.ZERO;
        if (discount.compareTo(subtotal) > 0) {
            throw new IllegalArgumentException(
                    "La remise dépasse le total de la vente (" + subtotal + " DH)");
        }
        BigDecimal total = subtotal.subtract(discount);

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
            CustomerPayment payment = new CustomerPayment();
            payment.setCustomer(customer);
            payment.setSale(saved);
            payment.setAmount(paid);
            paymentRepository.save(payment);
        }

        return saved;
    }

    @Transactional
    public Sale cancel(UUID saleId, String reason) {
        Sale sale = saleRepository.findByIdForUpdate(saleId)
                .orElseThrow(() -> new IllegalArgumentException("Vente introuvable"));

        if (sale.getStatus() == SaleStatus.CANCELLED) {
            throw new IllegalArgumentException("Cette vente est déjà annulée");
        }

        // On remet les articles en stock
        for (SaleLine line : sale.getLines()) {
            Product product = productRepository.findByIdForUpdate(line.getProduct().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
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

    @Transactional(readOnly = true)
    public Sale findById(UUID id) {
        return saleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Vente introuvable"));
    }

    @Transactional(readOnly = true)
    public List<Sale> findAll() {
        return saleRepository.findAllByOrderBySaleDateDesc();
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
