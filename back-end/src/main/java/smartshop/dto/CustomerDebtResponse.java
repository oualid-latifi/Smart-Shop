package smartshop.dto;

import smartshop.repository.CustomerDebtView;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record CustomerDebtResponse(
        UUID customerId,
        String name,
        String phone,
        BigDecimal debt,
        LocalDateTime oldestSaleDate,
        boolean over30Days            // vrai si la plus ancienne dette a plus de 30 jours
) {

    public static CustomerDebtResponse from(CustomerDebtView v) {
        boolean over30 = v.getOldestSaleDate().isBefore(LocalDateTime.now().minusDays(30));
        return new CustomerDebtResponse(
                v.getCustomerId(), v.getName(), v.getPhone(),
                v.getDebt(), v.getOldestSaleDate(), over30);
    }
}
