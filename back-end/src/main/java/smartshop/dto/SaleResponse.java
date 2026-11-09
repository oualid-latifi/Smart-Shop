package smartshop.dto;

import smartshop.entity.Sale;
import smartshop.entity.SaleStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SaleResponse(
        UUID id,
        String number,
        String invoiceNumber,
        String deliveryNumber,
        UUID customerId,
        String customerName,
        String customerPhone,
        String sellerName,
        LocalDateTime saleDate,
        BigDecimal discount,
        BigDecimal discountPercent,
        BigDecimal total,
        BigDecimal returnedAmount,
        BigDecimal refundedAmount,
        BigDecimal netTotal,
        smartshop.entity.PaymentMethod paymentMethod,
        BigDecimal amountPaid,
        BigDecimal remaining,
        BigDecimal profit,
        SaleStatus status,
        String cancellationReason,
        List<SaleLineResponse> lines,
        List<ReturnSummary> returns
) {

    public record ReturnSummary(UUID id, LocalDateTime returnedAt, BigDecimal creditAmount, BigDecimal refundAmount, String reason) {
    }

    public static SaleResponse from(Sale s) {
        return new SaleResponse(
                s.getId(),
                s.getDisplayNumber(),
                s.getInvoiceNumber(),
                s.getDeliveryNumber(),
                s.getCustomer() != null ? s.getCustomer().getId() : null,
                s.getCustomer() != null ? s.getCustomer().getName() : null,
                s.getCustomer() != null ? s.getCustomer().getPhone() : null,
                s.getSeller() != null ? s.getSeller().getName() : null,
                s.getSaleDate(),
                s.getDiscount(),
                s.getDiscountPercent(),
                s.getTotal(),
                s.getReturnedAmount(),
                s.getRefundedAmount(),
                s.getNetTotal(),
                s.getPaymentMethod(),
                s.getAmountPaid(),
                s.getRemaining(),
                smartshop.security.CurrentUser.canSeeMargins() ? s.getProfit() : null,
                s.getStatus(),
                s.getCancellationReason(),
                s.getLines().stream().map(SaleLineResponse::from).toList(),
                s.getReturns().stream()
                        .map(r -> new ReturnSummary(r.getId(), r.getReturnedAt(), r.getCreditAmount(), r.getRefundAmount(), r.getReason()))
                        .toList());
    }
}
