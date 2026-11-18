package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.ShopSettings;

public interface ShopSettingsRepository extends JpaRepository<ShopSettings, Long> {

    @org.springframework.data.jpa.repository.Query("select s from ShopSettings s where s.shopId = :shopId")
    java.util.Optional<ShopSettings> findByShopId(@org.springframework.data.repository.query.Param("shopId") java.util.UUID shopId);
}
