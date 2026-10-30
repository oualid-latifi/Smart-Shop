package smartshop.dto;

import smartshop.repository.TopProductView;

import java.math.BigDecimal;
import java.util.UUID;

public record TopProductResponse(
        UUID productId,
        String name,
        long quantitySold,
        BigDecimal revenue
) {

    public static TopProductResponse from(TopProductView v) {
        return new TopProductResponse(v.getProductId(), v.getName(), v.getQuantity(), v.getRevenue());
    }
}
