package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.Shop;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopRepository extends JpaRepository<Shop, UUID> {

    Optional<Shop> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Shop> findByActiveTrue();
}
