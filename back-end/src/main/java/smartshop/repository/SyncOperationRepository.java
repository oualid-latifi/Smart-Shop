package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.SyncOperation;

public interface SyncOperationRepository extends JpaRepository<SyncOperation, String> {
}
