package smartshop.dto;

import smartshop.entity.Expense;
import smartshop.entity.ExpenseCategory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ExpenseResponse(
        UUID id,
        ExpenseCategory category,
        BigDecimal amount,
        LocalDate expenseDate,
        String note
) {

    public static ExpenseResponse from(Expense e) {
        return new ExpenseResponse(
                e.getId(), e.getCategory(), e.getAmount(), e.getExpenseDate(), e.getNote());
    }
}
