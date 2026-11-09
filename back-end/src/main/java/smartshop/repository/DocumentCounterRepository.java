package smartshop.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.DocumentCounter;

import java.util.Optional;

public interface DocumentCounterRepository extends JpaRepository<DocumentCounter, String> {

    // Verrou en écriture : deux ventes simultanées ne peuvent pas recevoir le même numéro
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from DocumentCounter c where c.key = :key")
    Optional<DocumentCounter> findForUpdate(@Param("key") String key);
}
