package smartshop.service;

import smartshop.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.PurchaseLineRequest;
import smartshop.dto.PurchaseRequest;
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
    private final smartshop.repository.PurchaseReturnRepository purchaseReturnRepository;

    public PurchaseService(PurchaseRepository purchaseRepository,
                           PurchasePaymentRepository paymentRepository,
                           SupplierRepository supplierRepository,
                           ProductRepository productRepository,
                           StockMovementRepository stockMovementRepository,
                           smartshop.repository.PurchaseReturnRepository purchaseReturnRepository) {
        this.purchaseRepository = purchaseRepository;
        this.paymentRepository = paymentRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.purchaseReturnRepository = purchaseReturnRepository;
    }

    @Transactional
    public Purchase create(PurchaseRequest request) {
        Supplier supplier = null;
        if (request.supplierId() != null) {
            supplier = supplierRepository.findById(request.supplierId())
                    .orElseThrow(() -> new ResourceNotFoundException("Fournisseur introuvable"));
        }

        Purchase purchase = new Purchase();
        purchase.setSupplier(supplier);
        purchase.setNote(request.note());

        BigDecimal total = BigDecimal.ZERO;

        for (PurchaseLineRequest lineRequest : request.lines()) {
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
            BigDecimal unitCost = byPack
                    ? lineRequest.unitPrice().divide(BigDecimal.valueOf(product.getUnitsPerPack()), 2, RoundingMode.HALF_UP)
                    : lineRequest.unitPrice();

            PurchaseLine line = new PurchaseLine();
            line.setProduct(product);
            line.setQuantity(units);
            line.setUnitPrice(unitCost);
            purchase.addLine(line);

            total = total.add(lineRequest.unitPrice()
                    .multiply(BigDecimal.valueOf(lineRequest.quantity())));

            addToStock(product, units, unitCost);
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

    /**
     * Renvoie des articles au fournisseur : le stock sort, la dette baisse ;
     * si l'achat était déjà payé, la différence est un remboursement du fournisseur.
     */
    @Transactional
    public Purchase createReturn(UUID purchaseId, smartshop.dto.PurchaseReturnRequest request) {
        Purchase purchase = findById(purchaseId);
        BigDecimal credit = BigDecimal.ZERO;
        for (smartshop.dto.PurchaseReturnRequest.Line lineRequest : request.lines()) {
            PurchaseLine bought = purchase.getLines().stream()
                    .filter(l -> l.getProduct().getId().equals(lineRequest.productId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Ce produit ne fait pas partie de l'achat"));
            int boughtQuantity = purchase.getLines().stream()
                    .filter(l -> l.getProduct().getId().equals(lineRequest.productId()))
                    .mapToInt(PurchaseLine::getQuantity).sum();
            int alreadyReturned = purchaseReturnRepository.sumReturnedQuantity(purchaseId, lineRequest.productId());
            if (lineRequest.quantity() > boughtQuantity - alreadyReturned) {
                throw new IllegalArgumentException("Quantité retournée trop grande pour " + bought.getProduct().getName()
                        + " (encore retournable : " + (boughtQuantity - alreadyReturned) + ")");
            }
            Product product = bought.getProduct();
            product.setStockQuantity(product.getStockQuantity() - lineRequest.quantity());
            productRepository.save(product);

            smartshop.entity.PurchaseReturn ret = new smartshop.entity.PurchaseReturn();
            ret.setPurchase(purchase);
            ret.setProduct(product);
            ret.setQuantity(lineRequest.quantity());
            ret.setUnitPrice(bought.getUnitPrice());
            ret.setReason(request.reason() != null && !request.reason().isBlank() ? request.reason().trim() : null);
            purchaseReturnRepository.save(ret);
            credit = credit.add(ret.getAmount());

            StockMovement movement = new StockMovement();
            movement.setProduct(product);
            movement.setType(StockMovementType.PURCHASE_RETURN);
            movement.setQuantity(-lineRequest.quantity());
            movement.setReferenceId(purchase.getId());
            movement.setNote(ret.getReason());
            stockMovementRepository.save(movement);
        }
        BigDecimal refund = credit.subtract(purchase.getRemaining().max(BigDecimal.ZERO)).max(BigDecimal.ZERO);
        purchase.setReturnedAmount(purchase.getReturnedAmount().add(credit));
        purchase.setRefundReceived(purchase.getRefundReceived().add(refund));
        return purchaseRepository.save(purchase);
    }

    @Transactional
    public Purchase addPayment(UUID purchaseId, BigDecimal amount) {
        Purchase purchase = findById(purchaseId);

        if (amount.compareTo(purchase.getRemaining()) > 0) {
            throw new IllegalArgumentException(
                    "Le paiement dépasse le reste à payer (" + purchase.getRemaining() + " DH)");
        }

        savePayment(purchase, amount);
        purchase.setAmountPaid(purchase.getAmountPaid().add(amount));
        return purchaseRepository.save(purchase);
    }

    @Transactional(readOnly = true)
    public Purchase findById(UUID id) {
        return purchaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Achat introuvable"));
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
        PurchasePayment payment = new PurchasePayment();
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
