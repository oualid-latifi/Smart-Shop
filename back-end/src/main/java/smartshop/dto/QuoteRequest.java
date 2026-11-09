package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record QuoteRequest(
        UUID customerId,                                         // client enregistré (facultatif)
        @Size(max = 150) String customerName,                    // ou nom libre d'un prospect
        @Future LocalDate validUntil,                            // facultatif : durée par défaut de la boutique
        @DecimalMin("0.00") BigDecimal discount,                 // remise en DH
        @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal discountPercent, // ou en %
        @Size(max = 500) String note,
        @NotEmpty @Valid List<SaleLineRequest> lines
) {
}
