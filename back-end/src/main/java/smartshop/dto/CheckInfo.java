package smartshop.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** Informations d'un chèque reçu. */
public record CheckInfo(
        @NotBlank @Size(max = 40) String number,
        @Size(max = 80) String bank,
        @NotNull LocalDate dueDate     // date d'encaissement prévue
) {
}
