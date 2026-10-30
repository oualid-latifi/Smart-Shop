package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.ExpenseRequest;
import smartshop.dto.ExpenseResponse;
import smartshop.service.ExpenseService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@Valid @RequestBody ExpenseRequest request) {
        return ExpenseResponse.from(expenseService.create(request));
    }

    // Exemple : GET /api/expenses?from=2026-10-01&to=2026-10-31
    @GetMapping
    public List<ExpenseResponse> findAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return expenseService.findBetween(from, to).stream().map(ExpenseResponse::from).toList();
    }

    @GetMapping("/{id}")
    public ExpenseResponse findById(@PathVariable UUID id) {
        return ExpenseResponse.from(expenseService.findById(id));
    }

    @PutMapping("/{id}")
    public ExpenseResponse update(@PathVariable UUID id,
                                  @Valid @RequestBody ExpenseRequest request) {
        return ExpenseResponse.from(expenseService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        expenseService.delete(id);
    }
}
