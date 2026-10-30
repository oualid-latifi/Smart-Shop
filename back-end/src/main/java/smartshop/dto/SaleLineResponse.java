package smartshop.dto;

import smartshop.entity.SaleLine;

import java.math.BigDecimal;
import java.util.UUID;

public record SaleLineResponse(
        UUID productId,
        String productName,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal unitCost
) {

    public static SaleLineResponse from(SaleLine l) {
        return new SaleLineResponse(
                l.getProduct().getId(),
                l.getProduct().getName(),
                l.getQuantity(),
                l.getUnitPrice(),
                l.getUnitCost());
    }
}
