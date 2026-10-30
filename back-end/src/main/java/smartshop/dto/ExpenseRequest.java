package smartshop.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.ExpenseCategory;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
        @NotNull ExpenseCategory category,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        LocalDate expenseDate,               // facultatif : aujourd'hui par défaut
        @Size(max = 255) String note
) {
}
