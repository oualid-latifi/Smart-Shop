package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.Category;

import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    boolean existsByNameIgnoreCase(String name);
}
