package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.CustomerPayment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, UUID> {

    // Pour les rapports : argent encaissé auprès des clients enregistrés (ventes annulées exclues)
    @Query("""
            select sum(p.amount) from CustomerPayment p
            where p.sale.status = smartshop.entity.SaleStatus.VALIDATED
              and p.paidAt >= :start and p.paidAt < :end
            """)
    BigDecimal sumValidatedBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
