package smartshop.dto;

import smartshop.entity.Purchase;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PurchaseResponse(
        UUID id,
        UUID supplierId,
        String supplierName,
        LocalDateTime purchaseDate,
        BigDecimal total,
        BigDecimal amountPaid,
        BigDecimal remaining,
        String note,
        List<PurchaseLineResponse> lines
) {

    public static PurchaseResponse from(Purchase p) {
        return new PurchaseResponse(
                p.getId(),
                p.getSupplier() != null ? p.getSupplier().getId() : null,
                p.getSupplier() != null ? p.getSupplier().getName() : null,
                p.getPurchaseDate(),
                p.getTotal(),
                p.getAmountPaid(),
                p.getRemaining(),
                p.getNote(),
                p.getLines().stream().map(PurchaseLineResponse::from).toList());
    }
}
