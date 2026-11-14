package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.Promotion;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    List<Promotion> findAllByOrderByStartsOnDesc();

    @Query("select p from Promotion p where p.active = true and p.startsOn <= :day and p.endsOn >= :day")
    List<Promotion> findRunning(@Param("day") LocalDate day);
}
