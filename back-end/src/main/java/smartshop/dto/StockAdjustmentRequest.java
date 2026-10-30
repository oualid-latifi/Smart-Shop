package smartshop.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record StockAdjustmentRequest(
        @NotNull UUID productId,
        @NotNull @Min(0) Integer countedQuantity,   // la quantité réellement comptée en boutique
        @NotBlank @Size(max = 255) String note      // raison : "Inventaire du 28/10", "Article cassé"...
) {
}