package smartshop.repository;

import java.math.BigDecimal;
import java.util.UUID;

public interface TopProductView {
    UUID getProductId();
    String getName();
    Long getQuantity();
    BigDecimal getRevenue();
}
