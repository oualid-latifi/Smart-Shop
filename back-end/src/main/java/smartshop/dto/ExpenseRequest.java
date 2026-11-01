package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.ExpenseCategory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ExpenseRequest(
        UUID id,
        @NotNull ExpenseCategory category,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        LocalDate expenseDate,
        @Size(max = 255) String note
) {
    public ExpenseRequest(ExpenseCategory category, BigDecimal amount, LocalDate expenseDate, String note) {
        this(null, category, amount, expenseDate, note);
    }
}
