package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.CustomerDebtResponse;
import smartshop.dto.CustomerRequest;
import smartshop.dto.CustomerResponse;
import smartshop.dto.PaymentRequest;
import smartshop.dto.SaleResponse;
import smartshop.service.CustomerService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
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

    // Clients qui ont encore une dette (kridi), la plus ancienne d'abord
    @GetMapping("/debtors")
    public List<CustomerDebtResponse> findDebtors() {
        return customerService.findDebtors();
    }

    @GetMapping("/{id}")
    public CustomerResponse findById(@PathVariable UUID id) {
        return customerService.findById(id);
    }

    @PutMapping("/{id}")
    public CustomerResponse update(@PathVariable UUID id,
                                   @Valid @RequestBody CustomerRequest request) {
        return customerService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        customerService.delete(id);
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
