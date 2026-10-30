package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import smartshop.entity.Product;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByReference(String reference);

    List<Product> findByActiveTrue();

    @Query("select p from Product p where p.active = true and p.stockQuantity <= p.alertThreshold")
    List<Product> findLowStock();

    @Query("""
            select sum(p.stockQuantity * p.averagePurchasePrice) from Product p
            where p.active = true and p.stockQuantity > 0
            """)
    BigDecimal sumStockValue();

    @Query("select count(p) from Product p where p.active = true and p.stockQuantity <= p.alertThreshold")
    long countLowStock();
}
