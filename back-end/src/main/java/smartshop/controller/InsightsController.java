package smartshop.controller;

import org.springframework.web.bind.annotation.*;
import smartshop.service.InsightsService;
import smartshop.service.StockInsightsService;

import java.util.List;
import java.util.UUID;

@RestController
public class InsightsController {

    private final InsightsService insightsService;
    private final StockInsightsService stockInsightsService;

    public InsightsController(InsightsService insightsService, StockInsightsService stockInsightsService) {
        this.insightsService = insightsService;
        this.stockInsightsService = stockInsightsService;
    }

    // Analyses : comparaison mensuelle, prévision, jours/heures forts, marge par marque
    @GetMapping("/api/reports/insights")
    public InsightsService.Insights insights(@RequestParam(defaultValue = "90") int days) {
        return insightsService.insights(days);
    }

    // Exemple : ?days=30&coverDays=15 -> de quoi tenir 15 jours au rythme des 30 derniers jours
    @GetMapping("/api/stock/replenishment")
    public List<StockInsightsService.Replenishment> replenishment(@RequestParam(defaultValue = "30") int days,
                                                                  @RequestParam(defaultValue = "15") int coverDays) {
        return stockInsightsService.replenishment(days, coverDays);
    }

    @GetMapping("/api/stock/dormant")
    public List<StockInsightsService.Dormant> dormant(@RequestParam(defaultValue = "60") int days) {
        return stockInsightsService.dormant(days);
    }

    @GetMapping("/api/stock/supplier-prices/{productId}")
    public List<StockInsightsService.SupplierPrice> supplierPrices(@PathVariable UUID productId) {
        return stockInsightsService.supplierPrices(productId);
    }
}
