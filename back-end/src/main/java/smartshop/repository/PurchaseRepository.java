package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.Purchase;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface PurchaseRepository extends JpaRepository<Purchase, UUID> {

    List<Purchase> findAllByOrderByPurchaseDateDesc();

    List<Purchase> findByPurchaseDateGreaterThanEqualAndPurchaseDateLessThanOrderByPurchaseDateAsc(LocalDateTime start, LocalDateTime end);

    // Achats pas encore payés en entier, les plus anciens d'abord
    @Query("select p from Purchase p where (p.total - coalesce(p.returnedAmount, 0) + coalesce(p.refundReceived, 0) - p.amountPaid) > 0 order by p.purchaseDate asc")
    List<Purchase> findUnpaid();

    // --- Pour les rapports ---

    @Query("select sum(p.total - coalesce(p.returnedAmount, 0)) from Purchase p where p.purchaseDate >= :start and p.purchaseDate < :end")
    BigDecimal sumTotalBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Ce que tu dois encore à tous les fournisseurs
    @Query("select sum((p.total - coalesce(p.returnedAmount, 0) + coalesce(p.refundReceived, 0) - p.amountPaid)) from Purchase p")
    BigDecimal sumAllDebt();
}
