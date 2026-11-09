package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.PurchaseOrderDtos.CreateRequest;
import smartshop.dto.PurchaseOrderDtos.OrderResponse;
import smartshop.dto.PurchaseOrderDtos.ReceiveRequest;
import smartshop.dto.PurchaseResponse;
import smartshop.entity.PurchaseOrder;
import smartshop.service.DocumentPdfService;
import smartshop.service.PurchaseOrderService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService orderService;
    private final DocumentPdfService pdfService;

    public PurchaseOrderController(PurchaseOrderService orderService, DocumentPdfService pdfService) {
        this.orderService = orderService;
        this.pdfService = pdfService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody CreateRequest request) {
        return OrderResponse.from(orderService.create(request));
    }

    @GetMapping
    public List<OrderResponse> findAll() {
        return orderService.findAll().stream().map(OrderResponse::from).toList();
    }

    @GetMapping("/{id}")
    public OrderResponse findById(@PathVariable UUID id) {
        return OrderResponse.from(orderService.findById(id));
    }

    @PostMapping("/{id}/receive")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseResponse receive(@PathVariable UUID id, @Valid @RequestBody(required = false) ReceiveRequest request) {
        return PurchaseResponse.from(orderService.receive(id, request));
    }

    @PostMapping("/{id}/cancel")
    public OrderResponse cancel(@PathVariable UUID id) {
        return OrderResponse.from(orderService.cancel(id));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        PurchaseOrder order = orderService.findById(id);
        return DocumentPdfService.inline(order.getNumber() + ".pdf", pdfService.purchaseOrder(order));
    }
}
