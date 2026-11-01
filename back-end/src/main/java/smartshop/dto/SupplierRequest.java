package smartshop.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SupplierRequest(
        UUID id,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 30) String phone
) {
    public SupplierRequest(String name, String phone) {
        this(null, name, phone);
    }
}
