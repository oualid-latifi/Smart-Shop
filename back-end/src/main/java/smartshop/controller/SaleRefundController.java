package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.RefundRequest;
import smartshop.entity.SaleRefund;
import smartshop.service.SaleRefundService;

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
    public SaleRefund refund(@PathVariable UUID id, @Valid @RequestBody RefundRequest request) {
        return refundService.refund(id, request);
    }
}
