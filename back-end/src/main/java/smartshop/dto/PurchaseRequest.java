package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record PurchaseRequest(
        UUID supplierId,                                 // facultatif
        @DecimalMin("0.00") BigDecimal amountPaid,       // payé tout de suite (facultatif)
        @Size(max = 255) String note,
        @NotEmpty @Valid List<PurchaseLineRequest> lines,
        UUID id
) {
    public PurchaseRequest(UUID supplierId, BigDecimal amountPaid, String note,
                           List<PurchaseLineRequest> lines) {
        this(supplierId, amountPaid, note, lines, null);
    }
}
