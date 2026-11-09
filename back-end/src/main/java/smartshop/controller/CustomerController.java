package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.AgingResponse;
import smartshop.dto.CustomerDebtResponse;
import smartshop.dto.CustomerRequest;
import smartshop.dto.CustomerResponse;
import smartshop.dto.PaymentRequest;
import smartshop.dto.SaleResponse;
import smartshop.dto.StatementResponse;
import smartshop.service.CustomerService;
import smartshop.service.DocumentPdfService;
import smartshop.service.StatementService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;
    private final StatementService statementService;
    private final DocumentPdfService pdfService;

    public CustomerController(CustomerService customerService, StatementService statementService, DocumentPdfService pdfService) {
        this.customerService = customerService;
        this.statementService = statementService;
        this.pdfService = pdfService;
    }

    // Ancienneté des créances : 0-30, 31-60, 61-90, plus de 90 jours
    @GetMapping("/aging")
    public List<AgingResponse> aging() {
        return statementService.aging();
    }

    @GetMapping("/{id}/statement")
    public StatementResponse statement(@PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statementService.statement(id, from, to);
    }

    @GetMapping("/{id}/statement.pdf")
    public ResponseEntity<byte[]> statementPdf(@PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        StatementResponse statement = statementService.statement(id, from, to);
        return DocumentPdfService.inline("releve.pdf", pdfService.statement(statement));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse create(@Valid @RequestBody CustomerRequest request) {
        return customerService.create(request);
    }

    @GetMapping
    public List<CustomerResponse> findAll() {
        return customerService.findAll();
    }

    @PutMapping("/{id}")
    public CustomerResponse update(@PathVariable UUID id,
                                   @Valid @RequestBody CustomerRequest request) {
        return customerService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable UUID id) {
        customerService.deactivate(id);
    }

    // Clients qui ont encore une dette (kridi), la plus ancienne d'abord
    @GetMapping("/debtors")
    public List<CustomerDebtResponse> findDebtors() {
        return customerService.findDebtors();
    }

    @GetMapping("/{id}")
    public CustomerResponse findById(@PathVariable UUID id) {
        return customerService.findById(id);
    }

    @GetMapping("/{id}/sales")
    public List<SaleResponse> findSales(@PathVariable UUID id) {
        return customerService.findSales(id);
    }

    // Le client rembourse une partie de son kridi
    @PostMapping("/{id}/payments")
    public CustomerResponse pay(@PathVariable UUID id,
                                @Valid @RequestBody PaymentRequest request) {
        return customerService.pay(id, request);
    }
}
