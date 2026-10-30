package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.Customer;

import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
}
