package smartshop.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** Ancienneté des créances d'un client, par tranche de jours depuis la vente. */
public record AgingResponse(
        UUID customerId,
        String name,
        String phone,
        BigDecimal total,
        BigDecimal days0to30,
        BigDecimal days31to60,
        BigDecimal days61to90,
        BigDecimal over90,
        int oldestDays
) {
}
