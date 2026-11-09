package smartshop.dto;

import smartshop.entity.CheckStatus;
import smartshop.entity.CustomerPayment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Un chèque reçu (éventuellement réparti sur plusieurs ventes). */
public record CheckResponse(
        UUID operationId,
        UUID customerId,
        String customerName,
        String customerPhone,
        String number,
        String bank,
        LocalDate dueDate,
        BigDecimal amount,
        CheckStatus status,
        LocalDateTime receivedAt,
        long daysUntilDue          // négatif = échéance dépassée
) {

    public static CheckResponse from(List<CustomerPayment> parts) {
        CustomerPayment first = parts.get(0);
        BigDecimal amount = parts.stream().map(CustomerPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long days = first.getCheckDueDate() != null
                ? java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), first.getCheckDueDate())
                : 0;
        return new CheckResponse(
                first.getOperationId() != null ? first.getOperationId() : first.getId(),
                first.getCustomer().getId(), first.getCustomer().getName(), first.getCustomer().getPhone(),
                first.getCheckNumber(), first.getCheckBank(), first.getCheckDueDate(),
                amount, first.getCheckStatus(), first.getPaidAt(), days);
    }
}
