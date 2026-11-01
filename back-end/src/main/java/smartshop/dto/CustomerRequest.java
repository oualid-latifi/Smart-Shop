package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CustomerRequest(
        UUID id,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 30) String phone,
        @DecimalMin("0.00") BigDecimal creditLimit
) {
    public CustomerRequest(String name, String phone, BigDecimal creditLimit) {
        this(null, name, phone, creditLimit);
    }
}
