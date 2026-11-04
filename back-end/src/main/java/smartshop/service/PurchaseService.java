package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.PurchaseLineRequest;
import smartshop.dto.PurchaseRequest;
import smartshop.dto.PaymentRequest;
import smartshop.entity.Product;
import smartshop.entity.Purchase;
import smartshop.entity.PurchaseLine;
import smartshop.entity.PurchasePayment;
import smartshop.entity.StockMovement;
import smartshop.entity.StockMovementType;
import smartshop.entity.Supplier;
import smartshop.repository.ProductRepository;
import smartshop.repository.PurchasePaymentRepository;
import smartshop.repository.PurchaseRepository;
import smartshop.repository.StockMovementRepository;
import smartshop.repository.SupplierRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
public class PurchaseService {

    private final PurchaseRepository purchaseRepository;
    private final PurchasePaymentRepository paymentRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;

    public PurchaseService(PurchaseRepository purchaseRepository,
                           PurchasePaymentRepository paymentRepository,
                           SupplierRepository supplierRepository,
                           ProductRepository productRepository,
                           StockMovementRepository stockMovementRepository) {
        this.purchaseRepository = purchaseRepository;
        this.paymentRepository = paymentRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    @Transactional
    public Purchase create(PurchaseRequest request) {
        // A mobile operation keeps the same UUID when retried after a network failure.
        if (request.id() != null) {
            Purchase existing = purchaseRepository.findByIdForUpdate(request.id()).orElse(null);
            if (existing != null) return existing;
        }

        Supplier supplier = null;
        if (request.supplierId() != null) {
            supplier = supplierRepository.findById(request.supplierId())
                    .orElseThrow(() -> new IllegalArgumentException("Fournisseur introuvable"));
        }

        Purchase purchase = new Purchase();
        if (request.id() != null) purchase.setId(request.id());
        if (request.purchaseDate() != null) purchase.setPurchaseDate(request.purchaseDate());
        purchase.setSupplier(supplier);
        purchase.setNote(request.note());

        BigDecimal total = BigDecimal.ZERO;

        for (PurchaseLineRequest lineRequest : request.lines()) {
            Product product = productRepository.findByIdForUpdate(lineRequest.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
            if (!product.getActive()) {
                throw new IllegalArgumentException(
                        "Le produit " + product.getName() + " est désactivé");
            }

            PurchaseLine line = new PurchaseLine();
            line.setProduct(product);
            line.setQuantity(lineRequest.quantity());
            line.setUnitPrice(lineRequest.unitPrice());
            purchase.addLine(line);

            // Le dernier prix réellement payé devient le prix de référence du prochain achat.
            product.setPurchasePrice(lineRequest.unitPrice());
            // The sale price entered during this purchase becomes the product's current sale price.
            if (lineRequest.salePrice() != null) {
                product.setSalePrice(lineRequest.salePrice());
            }

            total = total.add(lineRequest.unitPrice()
                    .multiply(BigDecimal.valueOf(lineRequest.quantity())));

            addToStock(product, lineRequest.quantity(), lineRequest.unitPrice());
        }

        BigDecimal paid = request.amountPaid() != null ? request.amountPaid() : BigDecimal.ZERO;
        if (paid.compareTo(total) > 0) {
            throw new IllegalArgumentException(
                    "Le montant payé dépasse le total de l'achat (" + total + " DH)");
        }
        purchase.setTotal(total);
        purchase.setAmountPaid(paid);

        Purchase saved = purchaseRepository.save(purchase);

        // Mouvements de stock : on les écrit après la sauvegarde pour avoir l'id de l'achat
        for (PurchaseLine line : saved.getLines()) {
            StockMovement movement = new StockMovement();
            movement.setProduct(line.getProduct());
            movement.setType(StockMovementType.PURCHASE);
            movement.setQuantity(line.getQuantity());
            movement.setReferenceId(saved.getId());
            stockMovementRepository.save(movement);
        }

        // Si une partie est payée tout de suite, on la garde aussi dans l'historique des paiements
        if (paid.signum() > 0) {
            savePayment(saved, paid);
        }

        return saved;
    }

    @Transactional
    public Purchase addPayment(UUID purchaseId, PaymentRequest request) {
        if (request.id() != null) {
            PurchasePayment existingPayment = paymentRepository.findById(request.id()).orElse(null);
            if (existingPayment != null) {
                if (!existingPayment.getPurchase().getId().equals(purchaseId)) {
                    throw new IllegalArgumentException("Cet identifiant de paiement est déjà utilisé");
                }
                return existingPayment.getPurchase();
            }
        }

        Purchase purchase = purchaseRepository.findByIdForUpdate(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException("Achat introuvable"));

        BigDecimal amount = request.amount();
        if (amount.compareTo(purchase.getRemaining()) > 0) {
            throw new IllegalArgumentException(
                    "Le paiement dépasse le reste à payer (" + purchase.getRemaining() + " DH)");
        }

        savePayment(purchase, amount, request.id(), request.paidAt());
        purchase.setAmountPaid(purchase.getAmountPaid().add(amount));
        return purchaseRepository.save(purchase);
    }

    /**
     * Modifie un achat sans toucher aux paiements déjà enregistrés.
     * Le stock est corrigé uniquement avec la différence entre les anciennes et nouvelles quantités.
     */
    @Transactional
    public Purchase update(UUID purchaseId, PurchaseRequest request) {
        Purchase purchase = purchaseRepository.findByIdForUpdate(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException("Achat introuvable"));

        Supplier supplier = null;
        if (request.supplierId() != null) {
            supplier = supplierRepository.findById(request.supplierId())
                    .orElseThrow(() -> new IllegalArgumentException("Fournisseur introuvable"));
        }

        BigDecimal newTotal = BigDecimal.ZERO;
        java.util.Map<UUID, Integer> oldQuantities = new java.util.HashMap<>();
        java.util.Map<UUID, Integer> newQuantities = new java.util.HashMap<>();
        java.util.Map<UUID, Product> products = new java.util.HashMap<>();

        for (PurchaseLine oldLine : purchase.getLines()) {
            UUID productId = oldLine.getProduct().getId();
            oldQuantities.merge(productId, oldLine.getQuantity(), Integer::sum);
            products.put(productId, oldLine.getProduct());
        }

        for (PurchaseLineRequest lineRequest : request.lines()) {
            Product product = productRepository.findByIdForUpdate(lineRequest.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
            if (!product.getActive()) {
                throw new IllegalArgumentException("Le produit " + product.getName() + " est désactivé");
            }
            products.put(product.getId(), product);
            newQuantities.merge(product.getId(), lineRequest.quantity(), Integer::sum);
            newTotal = newTotal.add(lineRequest.unitPrice()
                    .multiply(BigDecimal.valueOf(lineRequest.quantity())));
        }

        if (newTotal.compareTo(purchase.getAmountPaid()) < 0) {
            throw new IllegalArgumentException(
                    "Le nouveau total ne peut pas être inférieur au montant déjà payé ("
                            + purchase.getAmountPaid() + " DH)");
        }

        java.util.Set<UUID> productIds = new java.util.HashSet<>(oldQuantities.keySet());
        productIds.addAll(newQuantities.keySet());
        for (UUID productId : productIds) {
            Product product = products.get(productId);
            int oldQty = oldQuantities.getOrDefault(productId, 0);
            int newQty = newQuantities.getOrDefault(productId, 0);
            int delta = newQty - oldQty;
            int correctedStock = product.getStockQuantity() + delta;
            if (correctedStock < 0) {
                throw new IllegalArgumentException("Stock insuffisant pour corriger l'achat du produit "
                        + product.getName() + ". Stock actuel: " + product.getStockQuantity());
            }
            if (delta > 0) {
                // L'ajout supplémentaire est intégré au coût moyen du stock.
                BigDecimal oldValue = product.getAveragePurchasePrice()
                        .multiply(BigDecimal.valueOf(Math.max(product.getStockQuantity(), 0)));
                BigDecimal addedUnitValue = BigDecimal.ZERO;
                int requestedQty = newQuantities.getOrDefault(productId, 0);
                for (PurchaseLineRequest line : request.lines()) {
                    if (line.productId().equals(productId)) {
                        addedUnitValue = addedUnitValue.add(line.unitPrice()
                                .multiply(BigDecimal.valueOf(line.quantity())));
                    }
                }
                BigDecimal addedValue = requestedQty > 0
                        ? addedUnitValue.multiply(BigDecimal.valueOf(delta))
                                .divide(BigDecimal.valueOf(requestedQty), 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
                if (correctedStock > 0) {
                    product.setAveragePurchasePrice(oldValue.add(addedValue)
                            .divide(BigDecimal.valueOf(correctedStock), 2, RoundingMode.HALF_UP));
                }
            }
            product.setStockQuantity(correctedStock);
            productRepository.save(product);
        }

        purchase.getLines().clear();
        for (PurchaseLineRequest lineRequest : request.lines()) {
            Product product = products.get(lineRequest.productId());
            PurchaseLine line = new PurchaseLine();
            line.setProduct(product);
            line.setQuantity(lineRequest.quantity());
            line.setUnitPrice(lineRequest.unitPrice());
            purchase.addLine(line);
            product.setPurchasePrice(lineRequest.unitPrice());
            if (lineRequest.salePrice() != null) product.setSalePrice(lineRequest.salePrice());
            productRepository.save(product);
        }

        purchase.setSupplier(supplier);
        purchase.setNote(request.note());
        if (request.purchaseDate() != null) purchase.setPurchaseDate(request.purchaseDate());
        purchase.setTotal(newTotal);

        Purchase saved = purchaseRepository.save(purchase);
        stockMovementRepository.deleteAllByReferenceIdAndType(
                saved.getId(), StockMovementType.PURCHASE);
        for (PurchaseLine line : saved.getLines()) {
            StockMovement movement = new StockMovement();
            movement.setProduct(line.getProduct());
            movement.setType(StockMovementType.PURCHASE);
            movement.setQuantity(line.getQuantity());
            movement.setReferenceId(saved.getId());
            stockMovementRepository.save(movement);
        }
        return saved;
    }

    /**
     * Suppression sécurisée : un achat ayant déjà un paiement ne peut pas être supprimé,
     * afin de préserver l'historique financier.
     */
    @Transactional
    public void delete(UUID purchaseId) {
        Purchase purchase = purchaseRepository.findByIdForUpdate(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException("Achat introuvable"));
        if (purchase.getAmountPaid().signum() > 0
                || paymentRepository.existsByPurchase_Id(purchaseId)) {
            throw new IllegalArgumentException(
                    "Impossible de supprimer cet achat : il possède déjà un paiement. Corrigez-le au lieu de le supprimer.");
        }

        java.util.Map<UUID, Integer> quantities = new java.util.HashMap<>();
        java.util.Map<UUID, Product> products = new java.util.HashMap<>();
        for (PurchaseLine line : purchase.getLines()) {
            UUID productId = line.getProduct().getId();
            quantities.merge(productId, line.getQuantity(), Integer::sum);
            products.put(productId, line.getProduct());
        }
        for (java.util.Map.Entry<UUID, Integer> entry : quantities.entrySet()) {
            Product product = products.get(entry.getKey());
            int correctedStock = product.getStockQuantity() - entry.getValue();
            if (correctedStock < 0) {
                throw new IllegalArgumentException("Impossible de supprimer cet achat : une partie du stock a déjà été vendue pour "
                        + product.getName());
            }
            product.setStockQuantity(correctedStock);
            productRepository.save(product);
        }

        stockMovementRepository.deleteAllByReferenceIdAndType(
                purchaseId, StockMovementType.PURCHASE);
        purchaseRepository.delete(purchase);
    }

    @Transactional(readOnly = true)
    public Purchase findById(UUID id) {
        return purchaseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Achat introuvable"));
    }

    @Transactional(readOnly = true)
    public List<Purchase> findAll() {
        return purchaseRepository.findAllByOrderByPurchaseDateDesc();
    }

    @Transactional(readOnly = true)
    public List<Purchase> findUnpaid() {
        return purchaseRepository.findUnpaid();
    }

    private void savePayment(Purchase purchase, BigDecimal amount) {
        savePayment(purchase, amount, null, null);
    }

    private void savePayment(Purchase purchase, BigDecimal amount, UUID paymentId,
                             java.time.LocalDateTime paidAt) {
        PurchasePayment payment = new PurchasePayment();
        if (paymentId != null) payment.setId(paymentId);
        if (paidAt != null) payment.setPaidAt(paidAt);
        payment.setPurchase(purchase);
        payment.setAmount(amount);
        paymentRepository.save(payment);
    }

    /**
     * Ajoute la quantité achetée au stock et recalcule le prix d'achat moyen.
     * Exemple : 10 chargeurs à 20 DH en stock + 10 achetés à 25 DH
     *           => (10 x 20 + 10 x 25) / 20 = 22,50 DH
     */
    private void addToStock(Product product, int quantity, BigDecimal unitPrice) {
        int oldQuantity = product.getStockQuantity();
        BigDecimal newAverage;

        if (oldQuantity <= 0) {
            // Pas de stock (ou stock négatif) : le nouveau prix devient la référence
            newAverage = unitPrice;
        } else {
            BigDecimal oldValue = product.getAveragePurchasePrice()
                    .multiply(BigDecimal.valueOf(oldQuantity));
            BigDecimal newValue = unitPrice.multiply(BigDecimal.valueOf(quantity));
            newAverage = oldValue.add(newValue)
                    .divide(BigDecimal.valueOf(oldQuantity + quantity), 2, RoundingMode.HALF_UP);
        }

        product.setAveragePurchasePrice(newAverage);
        product.setStockQuantity(oldQuantity + quantity);
        productRepository.save(product);
    }
}
