package smartshop.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public interface CustomerDebtView {
    UUID getCustomerId();
    String getName();
    String getPhone();
    BigDecimal getDebt();
    LocalDateTime getOldestSaleDate();
}
