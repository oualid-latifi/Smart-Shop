package smartshop.dto;

import smartshop.entity.Product;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String reference,
        String name,
        String brand,
        String model,
        String color,
        String capacity,
        String imageUrl,
        BigDecimal averagePurchasePrice,
        BigDecimal purchasePrice,
        BigDecimal salePrice,
        Integer stockQuantity,
        Integer alertThreshold,
        boolean lowStock,
        boolean active
) {

    public static ProductResponse from(Product p) {
        return new ProductResponse(
                p.getId(),
                p.getReference(),
                p.getName(),
                p.getBrand(),
                p.getModel(),
                p.getColor(),
                p.getCapacity(),
                p.getImageUrl(),
                p.getAveragePurchasePrice(),
                p.getPurchasePrice(),
                p.getSalePrice(),
                p.getStockQuantity(),
                p.getAlertThreshold(),
                p.getStockQuantity() <= p.getAlertThreshold(),
                p.getActive()
        );
    }
}
