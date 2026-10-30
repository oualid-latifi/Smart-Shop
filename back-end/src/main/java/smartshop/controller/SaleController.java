package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.CancelSaleRequest;
import smartshop.dto.SaleRequest;
import smartshop.dto.SaleResponse;
import smartshop.service.SaleService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse create(@Valid @RequestBody SaleRequest request) {
        return SaleResponse.from(saleService.create(request));
    }

    @GetMapping
    public List<SaleResponse> findAll() {
        return saleService.findAll().stream().map(SaleResponse::from).toList();
    }

    @GetMapping("/{id}")
    public SaleResponse findById(@PathVariable UUID id) {
        return SaleResponse.from(saleService.findById(id));
    }

    @PostMapping("/{id}/cancel")
    public SaleResponse cancel(@PathVariable UUID id,
                               @Valid @RequestBody CancelSaleRequest request) {
        return SaleResponse.from(saleService.cancel(id, request.reason()));
    }
}
