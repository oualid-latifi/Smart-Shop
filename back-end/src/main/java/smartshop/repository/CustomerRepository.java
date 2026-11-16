package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.Customer;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findFirstByPhone(String phone);

    /** Clients modifiés, ou dont la dette a changé (vente, paiement, annulation) depuis cette date. */
    @org.springframework.data.jpa.repository.Query("""
            select c from Customer c where c.updatedAt > :since
               or c.id in (select s.customer.id from Sale s where s.updatedAt > :since and s.customer is not null)
            """)
    java.util.List<Customer> findChangedSince(@org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);
}
