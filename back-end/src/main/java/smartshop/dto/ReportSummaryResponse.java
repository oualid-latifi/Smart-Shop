package smartshop.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ReportSummaryResponse(
        LocalDate from,
        LocalDate to,

        // Sur la période
        long salesCount,
        BigDecimal revenue,
        BigDecimal costOfGoodsSold,
        BigDecimal grossProfit,
        BigDecimal expenses,
        BigDecimal netProfit,
        BigDecimal cashCollected,
        BigDecimal paidToSuppliers,
        BigDecimal purchasesTotal,
        BigDecimal netCashFlow,
        List<TopProductResponse> topProducts,

        // À l'instant présent (indépendant de la période)
        BigDecimal totalCustomerDebt,
        BigDecimal totalSupplierDebt,
        BigDecimal stockValue,
        long lowStockCount
) {
}
