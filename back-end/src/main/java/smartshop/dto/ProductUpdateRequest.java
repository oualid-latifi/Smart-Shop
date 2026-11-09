package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProductUpdateRequest(
        @NotBlank @Size(max = 50) String reference,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 64) String barcode,                       // facultatif : code-barres
        @Size(max = 80) String brand,
        @Size(max = 100) String model,
        @Size(max = 50) String color,
        @Size(max = 60) String capacity,
        String imageUrl,
        @NotNull @DecimalMin("0.00") BigDecimal salePrice,
        @jakarta.validation.constraints.Min(2) Integer unitsPerPack,                  // facultatif : unités par carton
        @DecimalMin("0.00") BigDecimal packPrice,                                    // facultatif : prix du carton
        @DecimalMin("0.00") @jakarta.validation.constraints.DecimalMax("100.00") BigDecimal vatRate,   // facultatif : TVA de la boutique par défaut
        @NotNull @Min(0) Integer alertThreshold
) {
}