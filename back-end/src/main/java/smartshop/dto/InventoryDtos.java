package smartshop.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.InventoryCount;
import smartshop.entity.InventoryCountLine;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Requêtes et réponses de l'inventaire physique. */
public final class InventoryDtos {

    private InventoryDtos() {
    }

    /** productIds vide = tous les produits actifs. */
    public record OpenRequest(List<UUID> productIds, @Size(max = 255) String note) {
    }

    public record CountRequest(@NotEmpty @Valid List<Count> counts) {
    }

    /** countedQuantity null = remettre "non compté". */
    public record Count(@NotNull UUID productId, @Min(0) Integer countedQuantity) {
    }

    public record LineResponse(UUID productId, String productName, String reference, Integer expectedQuantity,
                               Integer countedQuantity, Integer difference, BigDecimal differenceValue) {
        static LineResponse from(InventoryCountLine l) {
            return new LineResponse(l.getProduct().getId(), l.getProductName(), l.getProduct().getReference(),
                    l.getExpectedQuantity(), l.getCountedQuantity(), l.getDifference(), l.getDifferenceValue());
        }
    }

    public record InventoryResponse(UUID id, String number, LocalDateTime openedAt, LocalDateTime closedAt,
                                    InventoryCount.Status status, String note,
                                    int productCount, int countedCount, int discrepancyCount,
                                    BigDecimal shortageValue, BigDecimal surplusValue,
                                    List<LineResponse> lines) {

        public static InventoryResponse from(InventoryCount inv, boolean withLines) {
            int counted = 0;
            int discrepancies = 0;
            BigDecimal shortage = BigDecimal.ZERO;
            BigDecimal surplus = BigDecimal.ZERO;
            for (InventoryCountLine l : inv.getLines()) {
                if (l.getCountedQuantity() == null) continue;
                counted++;
                if (l.getDifference() != 0) discrepancies++;
                BigDecimal value = l.getDifferenceValue();
                if (value.signum() < 0) shortage = shortage.add(value.negate());
                else surplus = surplus.add(value);
            }
            return new InventoryResponse(inv.getId(), inv.getNumber(), inv.getOpenedAt(), inv.getClosedAt(),
                    inv.getStatus(), inv.getNote(), inv.getLines().size(), counted, discrepancies, shortage, surplus,
                    withLines ? inv.getLines().stream().map(LineResponse::from).toList() : List.of());
        }
    }
}
