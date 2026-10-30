package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.Supplier;

import java.util.UUID;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {
}
