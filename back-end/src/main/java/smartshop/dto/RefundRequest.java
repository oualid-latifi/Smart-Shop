package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record RefundRequest(
        @NotEmpty List<@NotNull @Valid RefundLineRequest> lines,
        @NotBlank String reason,
        UUID id
) {
    public RefundRequest(List<RefundLineRequest> lines, String reason) {
        this(lines, reason, null);
    }
}
