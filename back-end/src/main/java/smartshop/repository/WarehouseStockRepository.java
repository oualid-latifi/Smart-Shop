package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.WarehouseStock;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WarehouseStockRepository extends JpaRepository<WarehouseStock, UUID> {

    Optional<WarehouseStock> findByWarehouse_IdAndProduct_Id(UUID warehouseId, UUID productId);

    @Query("select s from WarehouseStock s where s.warehouse.id = :warehouseId and s.quantity <> 0 order by s.product.name asc")
    List<WarehouseStock> findStock(@Param("warehouseId") UUID warehouseId);

    @Query("select s from WarehouseStock s where s.product.id = :productId and s.quantity <> 0")
    List<WarehouseStock> findByProduct(@Param("productId") UUID productId);

    // Valeur du stock des dépôts vendables (la quarantaine est exclue)
    @Query("""
            select sum(s.quantity * s.product.averagePurchasePrice) from WarehouseStock s
            where s.warehouse.type = smartshop.entity.Warehouse.Type.STORAGE and s.quantity > 0
            """)
    BigDecimal sumStorageValue();
}
