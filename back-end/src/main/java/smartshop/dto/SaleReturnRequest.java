package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.PaymentMethod;

import java.util.List;
import java.util.UUID;

public record SaleReturnRequest(
        @NotEmpty @Valid List<Line> lines,
        @Size(max = 255) String reason,
        PaymentMethod refundMethod      // si de l'argent est rendu : espèces par défaut
) {

    public record Line(
            @NotNull UUID productId,
            @NotNull @Min(1) Integer quantity,
            Boolean restock             // false = article abîmé, pas remis en stock (vrai par défaut)
    ) {
    }
}
