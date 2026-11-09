package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CustomerRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 30) String phone,
        @Size(max = 255) String address,                 // facultatif : imprimée sur les factures
        @Pattern(regexp = "^$|^\\d{15}$", message = "L'ICE contient 15 chiffres") String ice, // client professionnel
        @DecimalMin("0.00") BigDecimal creditLimit   // facultatif : pas de limite si absent
) {
}
