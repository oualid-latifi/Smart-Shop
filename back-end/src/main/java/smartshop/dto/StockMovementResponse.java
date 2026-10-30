package smartshop.dto;

import smartshop.entity.StockMovement;
import smartshop.entity.StockMovementType;

import java.time.LocalDateTime;
import java.util.UUID;

public record StockMovementResponse(
        UUID id,
        UUID productId,
        String productName,
        StockMovementType type,
        Integer quantity,          // positif = entrée, négatif = sortie
        UUID referenceId,          // id de l'achat ou de la vente concernée
        LocalDateTime createdAt,
        String note
) {

    public static StockMovementResponse from(StockMovement m) {
        return new StockMovementResponse(
                m.getId(),
                m.getProduct().getId(),
                m.getProduct().getName(),
                m.getType(),
                m.getQuantity(),
                m.getReferenceId(),
                m.getCreatedAt(),
                m.getNote());
    }
}