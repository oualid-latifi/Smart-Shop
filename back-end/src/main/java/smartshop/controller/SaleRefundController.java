package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.RefundRequest;
import smartshop.dto.RefundResponse;
import smartshop.service.SaleRefundService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sales")
public class SaleRefundController {
    private final SaleRefundService refundService;

    public SaleRefundController(SaleRefundService refundService) {
        this.refundService = refundService;
    }

    @PostMapping("/{id}/refunds")
    @ResponseStatus(HttpStatus.CREATED)
    public RefundResponse refund(@PathVariable UUID id, @Valid @RequestBody RefundRequest request) {
        return RefundResponse.from(refundService.refund(id, request));
    }

    @GetMapping("/{id}/refunds")
    public List<RefundResponse> history(@PathVariable UUID id) {
        return refundService.getRefundHistory(id).stream()
                .map(RefundResponse::from)
                .toList();
    }
}
