package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.PurchasePayment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, UUID> {

    // Pour les rapports : argent versé aux fournisseurs
    @Query("select sum(p.amount) from PurchasePayment p where p.paidAt >= :start and p.paidAt < :end")
    BigDecimal sumBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
