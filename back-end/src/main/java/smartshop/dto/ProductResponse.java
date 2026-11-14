package smartshop.dto;

import smartshop.entity.Product;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String reference,
        String name,
        String barcode,
        String brand,
        String model,
        String color,
        String capacity,
        String imageUrl,
        BigDecimal averagePurchasePrice,
        BigDecimal salePrice,
        BigDecimal vatRate,
        Integer unitsPerPack,
        BigDecimal packPrice,
        Integer stockQuantity,
        Integer alertThreshold,
        boolean lowStock,
        boolean active,
        BigDecimal promoPrice,          // prix unitaire en promotion (null si aucune)
        BigDecimal secondItemPercent,   // promotion "2e article à -X %"
        String promoLabel
) {

    public static ProductResponse from(Product p) {
        return from(p, null);
    }

    public static ProductResponse from(Product p, smartshop.service.PromotionService.Offer offer) {
        return new ProductResponse(
                p.getId(),
                p.getReference(),
                p.getName(),
                p.getBarcode(),
                p.getBrand(),
                p.getModel(),
                p.getColor(),
                p.getCapacity(),
                p.getImageUrl(),
                smartshop.security.CurrentUser.canSeeMargins() ? p.getAveragePurchasePrice() : null,
                p.getSalePrice(),
                p.getVatRate(),
                p.getUnitsPerPack(),
                p.getEffectivePackPrice(),
                p.getStockQuantity(),
                p.getAlertThreshold(),
                p.getStockQuantity() <= p.getAlertThreshold(),
                p.getActive(),
                offer != null ? offer.unitPrice() : null,
                offer != null ? offer.secondItemPercent() : null,
                offer != null ? offer.label() : null
        );
    }
}
