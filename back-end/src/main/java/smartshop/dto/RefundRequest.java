package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record RefundRequest(
        @NotEmpty List<@Valid RefundLineRequest> lines,
        @NotBlank String reason
) {}
