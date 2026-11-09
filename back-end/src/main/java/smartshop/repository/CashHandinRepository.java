package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.CashHandin;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface CashHandinRepository extends JpaRepository<CashHandin, UUID> {

    List<CashHandin> findTop100ByOrderByAtDesc();

    @Query("select coalesce(sum(h.amount), 0) from CashHandin h where h.employee.id = :userId")
    BigDecimal sumByEmployee(@Param("userId") UUID userId);

    // Espèces encaissées par l'employé auprès des clients enregistrés (ventes annulées et chèques exclus)
    @Query("""
            select coalesce(sum(p.amount), 0) from CustomerPayment p
            where p.collectedBy.id = :userId
              and (p.method is null or p.method = smartshop.entity.PaymentMethod.CASH)
              and p.sale.status = smartshop.entity.SaleStatus.VALIDATED
            """)
    BigDecimal sumCashCollected(@Param("userId") UUID userId);

    // Espèces des ventes aux clients de passage faites par l'employé
    @Query("""
            select coalesce(sum(s.amountPaid), 0) from Sale s
            where s.seller.id = :userId and s.customer is null
              and (s.paymentMethod is null or s.paymentMethod = smartshop.entity.PaymentMethod.CASH)
              and s.status = smartshop.entity.SaleStatus.VALIDATED
            """)
    BigDecimal sumWalkInCash(@Param("userId") UUID userId);
}
