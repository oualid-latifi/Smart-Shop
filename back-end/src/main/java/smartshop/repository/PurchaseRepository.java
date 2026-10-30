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

    // Achats pas encore payés en entier, les plus anciens d'abord
    @Query("select p from Purchase p where p.amountPaid < p.total order by p.purchaseDate asc")
    List<Purchase> findUnpaid();

    // --- Pour les rapports ---

    @Query("select sum(p.total) from Purchase p where p.purchaseDate >= :start and p.purchaseDate < :end")
    BigDecimal sumTotalBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Ce que tu dois encore à tous les fournisseurs
    @Query("select sum(p.total - p.amountPaid) from Purchase p")
    BigDecimal sumAllDebt();
}
