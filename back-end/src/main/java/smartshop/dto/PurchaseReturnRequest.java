package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record PurchaseReturnRequest(
        @NotEmpty @Valid List<Line> lines,
        @Size(max = 255) String reason
) {

    public record Line(@NotNull UUID productId, @NotNull @Min(1) Integer quantity) {
    }
}
