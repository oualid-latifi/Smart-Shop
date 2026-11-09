package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.SalesTarget;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalesTargetRepository extends JpaRepository<SalesTarget, UUID> {

    List<SalesTarget> findByMonth(String month);

    Optional<SalesTarget> findByUser_IdAndMonth(UUID userId, String month);

    // Chiffre d'affaires net (retours déduits) réalisé par un vendeur sur la période
    @Query("""
            select coalesce(sum(s.total - coalesce(s.returnedAmount, 0)), 0) from Sale s
            where s.seller.id = :userId and s.status = smartshop.entity.SaleStatus.VALIDATED
              and s.saleDate >= :start and s.saleDate < :end
            """)
    BigDecimal sumSalesBySeller(@Param("userId") UUID userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
            select count(s) from Sale s
            where s.seller.id = :userId and s.status = smartshop.entity.SaleStatus.VALIDATED
              and s.saleDate >= :start and s.saleDate < :end
            """)
    long countSalesBySeller(@Param("userId") UUID userId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
