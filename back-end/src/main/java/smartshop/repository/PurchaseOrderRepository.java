package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.PurchaseOrder;

import java.util.List;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    List<PurchaseOrder> findAllByOrderByCreatedAtDesc();
}
