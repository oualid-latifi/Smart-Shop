package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.PurchaseOrder;
import smartshop.entity.PurchaseOrderLine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public final class PurchaseOrderDtos {

    private PurchaseOrderDtos() {
    }

    public record CreateRequest(
            @NotNull UUID supplierId,
            LocalDate expectedDate,
            @Size(max = 255) String note,
            @NotEmpty @Valid List<PurchaseLineRequest> lines   // packs = true accepté : converti en unités
    ) {
    }

    /** lines vide ou absent = tout le reste à recevoir. */
    public record ReceiveRequest(@Valid List<ReceiveLine> lines, @DecimalMin("0.00") BigDecimal amountPaid) {
    }

    public record ReceiveLine(@NotNull UUID productId, @NotNull @Min(1) Integer quantity) {
    }

    public record LineResponse(UUID productId, String productName, Integer quantity, Integer receivedQuantity, BigDecimal unitPrice) {
        static LineResponse from(PurchaseOrderLine l) {
            return new LineResponse(l.getProduct().getId(), l.getProduct().getName(), l.getQuantity(), l.getReceivedQuantity(), l.getUnitPrice());
        }
    }

    public record OrderResponse(UUID id, String number, UUID supplierId, String supplierName, String supplierPhone,
                                LocalDateTime createdAt, LocalDate expectedDate, PurchaseOrder.Status status,
                                String note, BigDecimal total, List<LineResponse> lines) {
        public static OrderResponse from(PurchaseOrder o) {
            return new OrderResponse(o.getId(), o.getNumber(), o.getSupplier().getId(), o.getSupplier().getName(),
                    o.getSupplier().getPhone(), o.getCreatedAt(), o.getExpectedDate(), o.getStatus(), o.getNote(),
                    o.getTotal(), o.getLines().stream().map(LineResponse::from).toList());
        }
    }
}
