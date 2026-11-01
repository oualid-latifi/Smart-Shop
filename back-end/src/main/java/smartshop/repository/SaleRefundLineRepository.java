package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.SaleRefundLine;

import java.util.UUID;

public interface SaleRefundLineRepository extends JpaRepository<SaleRefundLine, UUID> {
    @Query("select coalesce(sum(rl.quantity), 0) from SaleRefundLine rl where rl.saleLine.id = :saleLineId")
    Integer sumReturnedQuantityBySaleLineId(@Param("saleLineId") UUID saleLineId);
}
