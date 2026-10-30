package smartshop.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.StockMovement;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {

    // Tous les mouvements d'une période, les plus récents d'abord
    List<StockMovement> findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            LocalDateTime start, LocalDateTime end, Pageable pageable);

    // Les mouvements d'un seul produit
    List<StockMovement> findByProductIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID productId, LocalDateTime start, LocalDateTime end, Pageable pageable);
}