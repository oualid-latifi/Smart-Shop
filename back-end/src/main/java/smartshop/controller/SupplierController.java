package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.SupplierRequest;
import smartshop.dto.SupplierResponse;
import smartshop.service.SupplierService;

import java.util.List;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupplierResponse create(@Valid @RequestBody SupplierRequest request) {
        return SupplierResponse.from(supplierService.create(request.name(), request.phone()));
    }

    @PutMapping("/{id}")
    public SupplierResponse update(@PathVariable java.util.UUID id,
                                   @Valid @RequestBody SupplierRequest request) {
        return SupplierResponse.from(supplierService.update(id, request.name(), request.phone()));
    }

    @GetMapping
    public List<SupplierResponse> findAll() {
        return supplierService.findAll().stream().map(SupplierResponse::from).toList();
    }
}
