package smartshop.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.Warehouse;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class WarehouseDtos {

    private WarehouseDtos() {
    }

    public record WarehouseRequest(@NotBlank @Size(max = 100) String name, Warehouse.Type type, Boolean active) {
    }

    public record WarehouseResponse(UUID id, String name, Warehouse.Type type, boolean active,
                                    int productCount, int totalUnits, BigDecimal value) {
    }

    public record StockLine(UUID productId, String productName, String reference, int quantity, BigDecimal value) {
    }

    /**
     * Transfert de stock. fromWarehouseId ou toWarehouseId null = la boutique.
     * Exemple : isoler un article abîmé = transfert de la boutique vers un dépôt QUARANTINE.
     */
    public record TransferRequest(@NotNull UUID productId, UUID fromWarehouseId, UUID toWarehouseId,
                                  @NotNull @Min(1) Integer quantity, @Size(max = 255) String note) {
    }

    /** Où se trouve le stock d'un produit. */
    public record ProductLocations(UUID productId, String productName, int shopQuantity, List<Location> warehouses) {
    }

    public record Location(UUID warehouseId, String name, Warehouse.Type type, int quantity) {
    }
}
