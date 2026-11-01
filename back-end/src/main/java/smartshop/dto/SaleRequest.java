package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;

import java.math.BigDecimal;
import java.util.List;
import java.time.LocalDateTime;
import java.util.UUID;

public record SaleRequest(
        UUID customerId,                               // facultatif : client de passage si absent
        @DecimalMin("0.00") BigDecimal discount,       // remise en DH (facultatif)
        @DecimalMin("0.00") BigDecimal amountPaid,     // facultatif : payé en entier si absent
        @NotEmpty @Valid List<SaleLineRequest> lines,
        UUID id,
        LocalDateTime saleDate
) {
    public SaleRequest(UUID customerId, BigDecimal discount, BigDecimal amountPaid,
                       List<SaleLineRequest> lines) {
        this(customerId, discount, amountPaid, lines, null, null);
    }
}
