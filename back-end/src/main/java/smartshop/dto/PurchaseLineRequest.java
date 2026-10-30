package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseLineRequest(
        @NotNull UUID productId,
        @NotNull @Min(1) Integer quantity,
        @NotNull @DecimalMin("0.00") BigDecimal unitPrice
) {
}
