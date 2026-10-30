package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.PaymentRequest;
import smartshop.dto.PurchaseRequest;
import smartshop.dto.PurchaseResponse;
import smartshop.service.PurchaseService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseService purchaseService;

    public PurchaseController(PurchaseService purchaseService) {
        this.purchaseService = purchaseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseResponse create(@Valid @RequestBody PurchaseRequest request) {
        return PurchaseResponse.from(purchaseService.create(request));
    }

    @GetMapping
    public List<PurchaseResponse> findAll() {
        return purchaseService.findAll().stream().map(PurchaseResponse::from).toList();
    }

    // Achats pas encore payés en entier (ce que tu dois aux fournisseurs)
    @GetMapping("/unpaid")
    public List<PurchaseResponse> findUnpaid() {
        return purchaseService.findUnpaid().stream().map(PurchaseResponse::from).toList();
    }

    @GetMapping("/{id}")
    public PurchaseResponse findById(@PathVariable UUID id) {
        return PurchaseResponse.from(purchaseService.findById(id));
    }

    @PostMapping("/{id}/payments")
    public PurchaseResponse addPayment(@PathVariable UUID id,
                                       @Valid @RequestBody PaymentRequest request) {
        return PurchaseResponse.from(purchaseService.addPayment(id, request.amount()));
    }
}
