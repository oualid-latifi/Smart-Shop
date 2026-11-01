package smartshop.dto;

import smartshop.entity.SaleRefund;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RefundResponse(
        UUID id,
        UUID saleId,
        BigDecimal amount,
        String reason,
        LocalDateTime refundedAt,
        List<RefundLineResponse> lines
) {
    public static RefundResponse from(SaleRefund refund) {
        return new RefundResponse(
                refund.getId(),
                refund.getSale().getId(),
                refund.getAmount(),
                refund.getReason(),
                refund.getRefundedAt(),
                refund.getLines().stream().map(RefundLineResponse::from).toList()
        );
    }
}
