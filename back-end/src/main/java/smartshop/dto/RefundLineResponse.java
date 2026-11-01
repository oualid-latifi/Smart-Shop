package smartshop.dto;

import smartshop.entity.SaleRefundLine;
import java.math.BigDecimal;
import java.util.UUID;

public record RefundLineResponse(
        UUID saleLineId,
        UUID productId,
        String productName,
        Integer quantity,
        BigDecimal amount
) {
    public static RefundLineResponse from(SaleRefundLine line) {
        return new RefundLineResponse(
                line.getSaleLine().getId(),
                line.getSaleLine().getProduct().getId(),
                line.getSaleLine().getProduct().getName(),
                line.getQuantity(),
                line.getRefundAmount()
        );
    }
}
