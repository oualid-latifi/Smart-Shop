package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.Sale;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface SaleRepository extends JpaRepository<Sale, UUID> {

    List<Sale> findAllByOrderBySaleDateDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Sale s where s.id = :id")
    java.util.Optional<Sale> findByIdForUpdate(@Param("id") UUID id);

    List<Sale> findByCustomer_IdOrderBySaleDateDesc(UUID customerId);

    // Dette totale d'un client (ventes annulées exclues). Peut renvoyer null s'il n'a aucune vente.
    @Query("""
            select sum(s.total - s.amountPaid - s.creditApplied) from Sale s
            where s.customer.id = :customerId
              and s.status = smartshop.entity.SaleStatus.VALIDATED
            """)
    BigDecimal sumDebtByCustomer(@Param("customerId") UUID customerId);

    // Ventes pas encore payées en entier, les plus anciennes d'abord
    @Query("""
            select s from Sale s
            where s.customer.id = :customerId
              and s.status = smartshop.entity.SaleStatus.VALIDATED
              and (s.amountPaid + s.creditApplied) < s.total
            order by s.saleDate asc
            """)
    List<Sale> findUnpaidByCustomer(@Param("customerId") UUID customerId);

    // Clients qui ont encore une dette, la plus ancienne d'abord
    @Query("""
            select c.id as customerId, c.name as name, c.phone as phone,
                   sum(s.total - s.amountPaid) as debt,
                   min(s.saleDate) as oldestSaleDate
            from Sale s join s.customer c
            where s.status = smartshop.entity.SaleStatus.VALIDATED
              and s.amountPaid < s.total
            group by c.id, c.name, c.phone
            order by min(s.saleDate) asc
            """)
    List<CustomerDebtView> findDebtors();

    // --- Pour les rapports ---

    @Query("""
            select count(s) from Sale s
            where s.status = smartshop.entity.SaleStatus.VALIDATED
              and s.saleDate >= :start and s.saleDate < :end
            """)
    long countValidatedBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("""
            select sum(s.total) from Sale s
            where s.status = smartshop.entity.SaleStatus.VALIDATED
              and s.saleDate >= :start and s.saleDate < :end
            """)
    BigDecimal sumTotalBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Ventes aux clients de passage : l'argent est encaissé tout de suite, sans ligne de paiement
    @Query("""
            select sum(s.amountPaid) from Sale s
            where s.customer is null
              and s.status = smartshop.entity.SaleStatus.VALIDATED
              and s.saleDate >= :start and s.saleDate < :end
            """)
    BigDecimal sumWalkInPaidBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    // Kridi restant chez tous les clients
    @Query("""
            select sum(s.total - s.amountPaid) from Sale s
            where s.status = smartshop.entity.SaleStatus.VALIDATED
            """)
    BigDecimal sumAllDebt();
}
