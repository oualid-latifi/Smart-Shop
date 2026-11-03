package smartshop.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProductCreateRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 80) String brand,
        @Size(max = 100) String model,
        @Min(0) Integer alertThreshold
) {
}
