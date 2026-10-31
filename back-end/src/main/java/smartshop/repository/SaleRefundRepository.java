package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.SaleRefund;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface SaleRefundRepository extends JpaRepository<SaleRefund, UUID> {
    @Query("select sum(r.amount) from SaleRefund r where r.sale.id = :saleId")
    BigDecimal sumBySaleId(@Param("saleId") UUID saleId);

    List<SaleRefund> findAllBySaleIdOrderByRefundedAtDesc(UUID saleId);

    @Query("select sum(r.amount) from SaleRefund r where r.refundedAt >= :start and r.refundedAt < :end")
    BigDecimal sumBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
