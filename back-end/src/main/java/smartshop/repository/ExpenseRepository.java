package smartshop.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import smartshop.entity.Expense;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    List<Expense> findByExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(LocalDate from, LocalDate to);

    // Pour les rapports
    @Query("select sum(e.amount) from Expense e where e.expenseDate >= :startDate and e.expenseDate <= :endDate")
    BigDecimal sumBetween(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
