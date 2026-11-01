package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.CustomerPayment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, UUID> {

    boolean existsByPaymentRequestId(UUID paymentRequestId);

    // Historique réel des encaissements : une annulation de vente n'efface pas l'argent déjà reçu.
    @Query("""
            select sum(p.amount) from CustomerPayment p
            where p.paidAt >= :start and p.paidAt < :end
            """)
    BigDecimal sumValidatedBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
