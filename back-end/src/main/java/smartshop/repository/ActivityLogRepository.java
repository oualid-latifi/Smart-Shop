package smartshop.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.ActivityLog;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {

    @Query("""
            select a from ActivityLog a
            where (:userId is null or a.userId = :userId)
              and a.at >= :start and a.at < :end
            order by a.at desc
            """)
    List<ActivityLog> search(@Param("userId") UUID userId,
                             @Param("start") LocalDateTime start,
                             @Param("end") LocalDateTime end,
                             Pageable pageable);
}
