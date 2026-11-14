package smartshop.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.Notification;
import smartshop.entity.Permission;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    boolean existsByDedupeKey(String dedupeKey);

    // Notifications visibles par un compte (selon ses droits), les plus récentes d'abord
    @Query("select n from Notification n where n.audience is null or n.audience in :permissions order by n.createdAt desc")
    List<Notification> findVisible(@Param("permissions") Collection<Permission> permissions, Pageable pageable);
}
