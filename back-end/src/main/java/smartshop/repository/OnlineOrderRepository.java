package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.OnlineOrder;

import java.util.List;
import java.util.UUID;

public interface OnlineOrderRepository extends JpaRepository<OnlineOrder, UUID> {

    List<OnlineOrder> findTop100ByOrderByCreatedAtDesc();

    List<OnlineOrder> findTop100ByStatusOrderByCreatedAtDesc(OnlineOrder.Status status);

    long countByStatus(OnlineOrder.Status status);
}
