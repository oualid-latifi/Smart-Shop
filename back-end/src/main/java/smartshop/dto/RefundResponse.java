package smartshop.dto;

import smartshop.entity.SaleRefund;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record RefundResponse(UUID id, UUID saleId, BigDecimal amount, String reason, LocalDateTime refundedAt) {
    public static RefundResponse from(SaleRefund refund) {
        return new RefundResponse(refund.getId(), refund.getSale().getId(), refund.getAmount(),
                refund.getReason(), refund.getRefundedAt());
    }
}
