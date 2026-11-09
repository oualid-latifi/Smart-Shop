package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.PurchaseReturn;

import java.util.UUID;

public interface PurchaseReturnRepository extends JpaRepository<PurchaseReturn, UUID> {

    @Query("""
            select coalesce(sum(r.quantity), 0) from PurchaseReturn r
            where r.purchase.id = :purchaseId and r.product.id = :productId
            """)
    int sumReturnedQuantity(@Param("purchaseId") UUID purchaseId, @Param("productId") UUID productId);
}
