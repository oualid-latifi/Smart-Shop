package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record PaymentRequest(
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        smartshop.entity.PaymentMethod method,          // facultatif : espèces par défaut
        @jakarta.validation.Valid CheckInfo check       // obligatoire si paiement par chèque
) {
}
