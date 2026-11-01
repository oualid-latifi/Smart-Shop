package smartshop.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Complete dated payment ledger used to rebuild reports while the mobile app is offline. */
public record PaymentHistoryResponse(
        List<CustomerPaymentEntry> customerPayments,
        List<PurchasePaymentEntry> purchasePayments
) {
    public record CustomerPaymentEntry(UUID id, UUID customerId, BigDecimal amount, LocalDateTime paidAt) {}
    public record PurchasePaymentEntry(UUID id, UUID purchaseId, BigDecimal amount, LocalDateTime paidAt) {}
}
