package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import smartshop.entity.AppUser;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByEmail(String email);

    // Les comptes ne sont pas filtrés automatiquement (la connexion cherche dans toutes les boutiques)
    java.util.List<AppUser> findByShopId(UUID shopId);

    Optional<AppUser> findByIdAndShopId(UUID id, UUID shopId);
}