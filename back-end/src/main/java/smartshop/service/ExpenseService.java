package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.ExpenseRequest;
import smartshop.entity.Expense;
import smartshop.repository.ExpenseRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ExpenseService {

    private static final LocalDate MIN_DATE = LocalDate.of(2000, 1, 1);
    private static final LocalDate MAX_DATE = LocalDate.of(2999, 12, 31);

    private final ExpenseRepository expenseRepository;

    public ExpenseService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    @Transactional
    public Expense create(ExpenseRequest request) {
        Expense expense = new Expense();
        apply(expense, request);
        return expenseRepository.save(expense);
    }

    @Transactional
    public Expense update(UUID id, ExpenseRequest request) {
        Expense expense = findById(id);
        apply(expense, request);
        return expenseRepository.save(expense);
    }

    @Transactional
    public void delete(UUID id) {
        Expense expense = findById(id);
        expenseRepository.delete(expense);
    }

    @Transactional(readOnly = true)
    public Expense findById(UUID id) {
        return expenseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Dépense introuvable"));
    }

    /** Liste les dépenses d'une période. Sans dates, renvoie toutes les dépenses. */
    @Transactional(readOnly = true)
    public List<Expense> findBetween(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : MIN_DATE;
        LocalDate end = to != null ? to : MAX_DATE;
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("La date de début doit être avant la date de fin");
        }
        return expenseRepository.findByExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(start, end);
    }

    private void apply(Expense expense, ExpenseRequest request) {
        expense.setCategory(request.category());
        expense.setAmount(request.amount());
        expense.setExpenseDate(request.expenseDate() != null ? request.expenseDate() : LocalDate.now());
        expense.setNote(request.note());
    }
}
