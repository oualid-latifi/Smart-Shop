package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.RefundLineRequest;
import smartshop.dto.RefundRequest;
import smartshop.entity.*;
import smartshop.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class SaleRefundService {
    private final SaleRepository saleRepository;
    private final SaleRefundRepository refundRepository;
    private final SaleRefundLineRepository refundLineRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;

    public SaleRefundService(SaleRepository saleRepository,
                             SaleRefundRepository refundRepository,
                             SaleRefundLineRepository refundLineRepository,
                             ProductRepository productRepository,
                             StockMovementRepository stockMovementRepository) {
        this.saleRepository = saleRepository;
        this.refundRepository = refundRepository;
        this.refundLineRepository = refundLineRepository;
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    @Transactional
    public SaleRefund refund(UUID saleId, RefundRequest request) {
        Sale sale = saleRepository.findByIdForUpdate(saleId)
                .orElseThrow(() -> new IllegalArgumentException("Vente introuvable"));

        if (sale.getStatus() != SaleStatus.VALIDATED) {
            throw new IllegalArgumentException("Impossible de retourner un article d'une vente déjà annulée");
        }

        BigDecimal originalSubtotal = sale.getLines().stream()
                .map(line -> line.getUnitPrice().multiply(BigDecimal.valueOf(line.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (originalSubtotal.signum() <= 0) {
            throw new IllegalArgumentException("Le total des articles de cette vente est invalide");
        }

        Set<UUID> processedLineIds = new HashSet<>();
        List<SaleRefundLine> refundLines = new ArrayList<>();
        BigDecimal refundTotal = BigDecimal.ZERO;

        // Validate and calculate the whole request before changing stock or debt.
        for (RefundLineRequest requestedLine : request.lines()) {
            if (!processedLineIds.add(requestedLine.saleLineId())) {
                throw new IllegalArgumentException("Un même article ne peut pas être répété dans la demande");
            }

            SaleLine saleLine = sale.getLines().stream()
                    .filter(line -> line.getId().equals(requestedLine.saleLineId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException(
                            "L'article demandé ne fait pas partie de cette vente"));

            Long returnedBefore = refundLineRepository
                    .sumReturnedQuantityBySaleLineId(saleLine.getId());
            long remainingQuantity = saleLine.getQuantity() - (returnedBefore == null ? 0L : returnedBefore);
            if (requestedLine.quantity() > remainingQuantity) {
                throw new IllegalArgumentException("Quantité retournée supérieure à la quantité restante pour "
                        + saleLine.getProduct().getName() + " (restant : " + remainingQuantity + ")");
            }

            BigDecimal requestedGross = saleLine.getUnitPrice()
                    .multiply(BigDecimal.valueOf(requestedLine.quantity()));
            BigDecimal allocatedDiscount = sale.getDiscount()
                    .multiply(requestedGross)
                    .divide(originalSubtotal, 2, RoundingMode.HALF_UP);
            BigDecimal lineRefundAmount = requestedGross.subtract(allocatedDiscount);

            SaleRefundLine refundLine = new SaleRefundLine();
            refundLine.setSaleLine(saleLine);
            refundLine.setQuantity(requestedLine.quantity());
            refundLine.setRefundAmount(lineRefundAmount);
            refundLines.add(refundLine);
            refundTotal = refundTotal.add(lineRefundAmount);
        }

        if (refundTotal.signum() <= 0) {
            throw new IllegalArgumentException("Le montant du remboursement doit être positif");
        }

        // First reduce the outstanding kridi. Only the excess is paid back in cash.
        BigDecimal creditApplied = refundTotal.min(sale.getRemaining());
        BigDecimal cashRefunded = refundTotal.subtract(creditApplied);

        SaleRefund refund = new SaleRefund();
        refund.setSale(sale);
        refund.setReason(request.reason().trim());
        refund.setAmount(refundTotal);
        refund.setCreditApplied(creditApplied);
        refund.setCashRefunded(cashRefunded);
        refundLines.forEach(refund::addLine);

        sale.setCreditApplied(sale.getCreditApplied().add(creditApplied));
        saleRepository.save(sale);

        for (SaleRefundLine refundLine : refundLines) {
            Product product = productRepository.findByIdForUpdate(refundLine.getSaleLine().getProduct().getId())
                    .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
            product.setStockQuantity(product.getStockQuantity() + refundLine.getQuantity());
            productRepository.save(product);

            StockMovement movement = new StockMovement();
            movement.setProduct(product);
            movement.setType(StockMovementType.SALE_RETURN);
            movement.setQuantity(refundLine.getQuantity());
            movement.setReferenceId(saleId);
            movement.setNote("Retour partiel : " + request.reason().trim());
            stockMovementRepository.save(movement);
        }

        return refundRepository.save(refund);
    }

    @Transactional(readOnly = true)
    public List<SaleRefund> getRefundHistory(UUID saleId) {
        if (!saleRepository.existsById(saleId)) {
            throw new IllegalArgumentException("Vente introuvable");
        }
        return refundRepository.findAllBySaleIdOrderByRefundedAtDesc(saleId);
    }
}
