package smartshop.entity;

public enum StockMovementType {
    PURCHASE,
    SALE,
    SALE_CANCELLATION,
    ADJUSTMENT,
    SALE_RETURN,
    PURCHASE_RETURN,
    TRANSFER_OUT,   // de la boutique vers un dépôt
    TRANSFER_IN     // d'un dépôt vers la boutique
}
