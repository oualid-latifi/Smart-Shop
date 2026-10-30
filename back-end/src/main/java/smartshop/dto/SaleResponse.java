package smartshop.dto;

import smartshop.entity.Sale;
import smartshop.entity.SaleStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SaleResponse(
        UUID id,
        UUID customerId,
        String customerName,
        LocalDateTime saleDate,
        BigDecimal discount,
        BigDecimal total,
        BigDecimal amountPaid,
        BigDecimal remaining,
        BigDecimal profit,
        SaleStatus status,
        String cancellationReason,
        List<SaleLineResponse> lines
) {

    public static SaleResponse from(Sale s) {
        return new SaleResponse(
                s.getId(),
                s.getCustomer() != null ? s.getCustomer().getId() : null,
                s.getCustomer() != null ? s.getCustomer().getName() : null,
                s.getSaleDate(),
                s.getDiscount(),
                s.getTotal(),
                s.getAmountPaid(),
                s.getRemaining(),
                s.getProfit(),
                s.getStatus(),
                s.getCancellationReason(),
                s.getLines().stream().map(SaleLineResponse::from).toList());
    }
}
