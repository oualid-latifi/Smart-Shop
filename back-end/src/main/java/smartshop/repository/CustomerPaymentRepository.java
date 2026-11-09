package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.CustomerPayment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, UUID> {

    List<CustomerPayment> findByCustomer_IdOrderByPaidAtAsc(UUID customerId);

    List<CustomerPayment> findByOperationId(UUID operationId);

    // Chèques reçus, triés par date d'échéance
    @Query("""
            select p from CustomerPayment p
            where p.method = smartshop.entity.PaymentMethod.CHECK
              and (:status is null or p.checkStatus = :status)
            order by p.checkDueDate asc, p.paidAt asc
            """)
    List<CustomerPayment> findChecks(@Param("status") smartshop.entity.CheckStatus status);

    // Pour les rapports : argent encaissé auprès des clients enregistrés (ventes annulées exclues)
    @Query("""
            select sum(p.amount) from CustomerPayment p
            where p.sale.status = smartshop.entity.SaleStatus.VALIDATED
              and (p.checkStatus is null or p.checkStatus <> smartshop.entity.CheckStatus.BOUNCED)
              and p.paidAt >= :start and p.paidAt < :end
            """)
    BigDecimal sumValidatedBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
