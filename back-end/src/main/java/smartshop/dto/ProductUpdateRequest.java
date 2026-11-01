package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductUpdateRequest(
        @NotBlank @Size(max = 50) String reference,
        @NotBlank @Size(max = 150) String name,
        UUID categoryId,
        @Size(max = 80) String brand,
        @Size(max = 100) String model,
        @Size(max = 50) String color,
        @Size(max = 60) String capacity,
        @Size(max = 500) String imageUrl,
        @NotNull @DecimalMin("0.00") BigDecimal salePrice,
        @NotNull @DecimalMin("0.00") BigDecimal purchasePrice,
        @NotNull @Min(0) Integer alertThreshold
) {
}