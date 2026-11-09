package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;

/** Transformation d'un devis en vente : seul le montant encaissé est demandé (vide = payé en entier). */
public record QuoteConvertRequest(
        @DecimalMin("0.00") BigDecimal amountPaid
) {
}
