package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.ProductResponse;
import smartshop.dto.StockAdjustmentRequest;
import smartshop.dto.StockMovementResponse;
import smartshop.service.StockService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/stock")
public class StockController {

    private final StockService stockService;

    public StockController(StockService stockService) {
        this.stockService = stockService;
    }

    // Exemple : GET /api/stock/movements?productId=...&from=2026-10-01&to=2026-10-31&limit=100
    @GetMapping("/movements")
    public List<StockMovementResponse> movements(
            @RequestParam(required = false) UUID productId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "200") int limit) {
        return stockService.findMovements(productId, from, to, limit);
    }

    // Inventaire : corrige le stock d'un produit avec la quantité comptée
    @PostMapping("/adjustments")
    public ProductResponse adjust(@Valid @RequestBody StockAdjustmentRequest request) {
        return ProductResponse.from(
                stockService.adjust(request.productId(), request.countedQuantity(), request.note()));
    }
}