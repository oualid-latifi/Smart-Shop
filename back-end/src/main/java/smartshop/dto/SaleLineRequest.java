package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record SaleLineRequest(
        @NotNull UUID productId,
        @NotNull @Min(1) Integer quantity,
        @DecimalMin("0.00") BigDecimal unitPrice   // facultatif : prix de vente du produit par défaut
) {
}
