package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.InventoryCount;

import java.util.List;
import java.util.UUID;

public interface InventoryCountRepository extends JpaRepository<InventoryCount, UUID> {

    List<InventoryCount> findAllByOrderByOpenedAtDesc();

    boolean existsByStatus(InventoryCount.Status status);
}
