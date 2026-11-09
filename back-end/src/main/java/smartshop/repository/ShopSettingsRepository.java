package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.ShopSettings;

public interface ShopSettingsRepository extends JpaRepository<ShopSettings, Long> {
}
