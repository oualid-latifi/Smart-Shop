package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.SaleRefundLine;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public interface SaleRefundLineRepository extends JpaRepository<SaleRefundLine, UUID> {
    @Query("select coalesce(sum(rl.quantity), 0) from SaleRefundLine rl where rl.saleLine.id = :saleLineId")
    Long sumReturnedQuantityBySaleLineId(@Param("saleLineId") UUID saleLineId);

    @Query("select sum(rl.saleLine.unitCost * rl.quantity) from SaleRefundLine rl where rl.refund.refundedAt >= :start and rl.refund.refundedAt < :end")
    BigDecimal sumReturnedCostBetween(@Param("start") LocalDateTime start,
                                      @Param("end") LocalDateTime end);
}
