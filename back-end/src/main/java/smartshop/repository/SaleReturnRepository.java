package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.SaleReturn;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface SaleReturnRepository extends JpaRepository<SaleReturn, UUID> {

    List<SaleReturn> findBySale_Customer_IdOrderByReturnedAtAsc(UUID customerId);

    // Coût d'achat des articles repris, rattaché à la période de la vente d'origine
    @Query("""
            select sum(l.unitCost * l.quantity) from SaleReturnLine l
            where l.saleReturn.sale.status = smartshop.entity.SaleStatus.VALIDATED
              and l.saleReturn.sale.saleDate >= :start and l.saleReturn.sale.saleDate < :end
            """)
    BigDecimal sumReturnedCostBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Argent rendu aux clients pendant la période
    @Query("""
            select sum(r.refundAmount) from SaleReturn r
            where r.returnedAt >= :start and r.returnedAt < :end
            """)
    BigDecimal sumRefundsBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
