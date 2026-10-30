package smartshop.dto;

import smartshop.entity.PurchaseLine;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseLineResponse(
        UUID productId,
        String productName,
        Integer quantity,
        BigDecimal unitPrice
) {

    public static PurchaseLineResponse from(PurchaseLine l) {
        return new PurchaseLineResponse(
                l.getProduct().getId(),
                l.getProduct().getName(),
                l.getQuantity(),
                l.getUnitPrice());
    }
}
