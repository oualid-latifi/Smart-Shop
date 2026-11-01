package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record PaymentRequest(
        UUID id,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        LocalDateTime paidAt
) {
}
