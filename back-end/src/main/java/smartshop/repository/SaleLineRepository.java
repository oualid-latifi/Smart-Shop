package smartshop.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.SaleLine;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface SaleLineRepository extends JpaRepository<SaleLine, UUID> {

    // Coût d'achat des articles vendus
    @Query("""
            select sum(l.unitCost * l.quantity) from SaleLine l
            where l.sale.status = smartshop.entity.SaleStatus.VALIDATED
              and l.sale.saleDate >= :start and l.sale.saleDate < :end
            """)
    BigDecimal sumCostBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Articles les plus vendus
    @Query("""
            select l.product.id as productId, l.product.name as name,
                   sum(l.quantity) as quantity, sum(l.unitPrice * l.quantity) as revenue
            from SaleLine l
            where l.sale.status = smartshop.entity.SaleStatus.VALIDATED
              and l.sale.saleDate >= :start and l.sale.saleDate < :end
            group by l.product.id, l.product.name
            order by sum(l.quantity) desc
            """)
    List<TopProductView> findTopProducts(@Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end,
                                         Pageable pageable);
}
