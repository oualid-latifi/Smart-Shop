package smartshop.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record RefundLineRequest(
        @NotNull UUID saleLineId,
        @NotNull @Min(1) Integer quantity
) {}
