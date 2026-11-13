package smartshop.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.ReportSummaryResponse;
import smartshop.dto.TopProductResponse;
import smartshop.repository.CustomerPaymentRepository;
import smartshop.repository.ExpenseRepository;
import smartshop.repository.ProductRepository;
import smartshop.repository.PurchasePaymentRepository;
import smartshop.repository.PurchaseRepository;
import smartshop.repository.SaleLineRepository;
import smartshop.repository.SaleRepository;
import smartshop.repository.SaleReturnRepository;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

@Service
public class ReportService {

    private static final int TOP_PRODUCTS_LIMIT = 5;

    private final SaleRepository saleRepository;
    private final SaleLineRepository saleLineRepository;
    private final CustomerPaymentRepository customerPaymentRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchasePaymentRepository purchasePaymentRepository;
    private final ExpenseRepository expenseRepository;
    private final ProductRepository productRepository;
    private final SaleReturnRepository saleReturnRepository;
    private final smartshop.repository.WarehouseStockRepository warehouseStockRepository;

    public ReportService(SaleRepository saleRepository,
                         SaleLineRepository saleLineRepository,
                         CustomerPaymentRepository customerPaymentRepository,
                         PurchaseRepository purchaseRepository,
                         PurchasePaymentRepository purchasePaymentRepository,
                         ExpenseRepository expenseRepository,
                         ProductRepository productRepository,
                         SaleReturnRepository saleReturnRepository,
                         smartshop.repository.WarehouseStockRepository warehouseStockRepository) {
        this.saleRepository = saleRepository;
        this.saleLineRepository = saleLineRepository;
        this.customerPaymentRepository = customerPaymentRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchasePaymentRepository = purchasePaymentRepository;
        this.expenseRepository = expenseRepository;
        this.productRepository = productRepository;
        this.saleReturnRepository = saleReturnRepository;
        this.warehouseStockRepository = warehouseStockRepository;
    }

    /** Sans dates : du début du mois jusqu'à aujourd'hui. */
    @Transactional(readOnly = true)
    public ReportSummaryResponse summary(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.withDayOfMonth(1);
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("La date de début doit être avant la date de fin");
        }

        // La fin est exclusive : on prend toute la journée de "to"
        LocalDateTime startTime = start.atStartOfDay();
        LocalDateTime endTime = end.plusDays(1).atStartOfDay();

        long salesCount = saleRepository.countValidatedBetween(startTime, endTime);
        BigDecimal revenue = nz(saleRepository.sumTotalBetween(startTime, endTime));
        BigDecimal cost = nz(saleLineRepository.sumCostBetween(startTime, endTime))
                .subtract(nz(saleReturnRepository.sumReturnedCostBetween(startTime, endTime)));
        BigDecimal grossProfit = revenue.subtract(cost);

        BigDecimal expenses = nz(expenseRepository.sumBetween(start, end));
        BigDecimal netProfit = grossProfit.subtract(expenses);

        BigDecimal cashCollected = nz(customerPaymentRepository.sumValidatedBetween(startTime, endTime))
                .add(nz(saleRepository.sumWalkInPaidBetween(startTime, endTime)))
                .subtract(nz(saleReturnRepository.sumRefundsBetween(startTime, endTime)));
        BigDecimal paidToSuppliers = nz(purchasePaymentRepository.sumBetween(startTime, endTime));
        BigDecimal purchasesTotal = nz(purchaseRepository.sumTotalBetween(startTime, endTime));
        BigDecimal netCashFlow = cashCollected.subtract(paidToSuppliers).subtract(expenses);

        List<TopProductResponse> topProducts = saleLineRepository
                .findTopProducts(startTime, endTime, PageRequest.of(0, TOP_PRODUCTS_LIMIT))
                .stream()
                .map(TopProductResponse::from)
                .toList();

        return new ReportSummaryResponse(
                start, end,
                salesCount, revenue, cost, grossProfit,
                expenses, netProfit,
                cashCollected, paidToSuppliers, purchasesTotal, netCashFlow,
                topProducts,
                nz(saleRepository.sumAllDebt()),
                nz(purchaseRepository.sumAllDebt()),
                // Boutique + dépôts de stockage (la quarantaine n'est pas comptée)
                nz(productRepository.sumStockValue()).add(nz(warehouseStockRepository.sumStorageValue())),
                productRepository.countLowStock());
    }

    public record DailyPoint(LocalDate date, long salesCount, BigDecimal revenue, BigDecimal grossProfit) {
    }

    /** Chiffre d'affaires et bénéfice brut de chacun des N derniers jours (aujourd'hui inclus). */
    @Transactional(readOnly = true)
    public List<DailyPoint> daily(int days) {
        int n = Math.min(Math.max(days, 1), 31);
        LocalDate today = LocalDate.now();
        List<DailyPoint> points = new java.util.ArrayList<>();
        for (int i = n - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            LocalDateTime start = day.atStartOfDay();
            LocalDateTime end = day.plusDays(1).atStartOfDay();
            BigDecimal revenue = nz(saleRepository.sumTotalBetween(start, end));
            BigDecimal cost = nz(saleLineRepository.sumCostBetween(start, end))
                    .subtract(nz(saleReturnRepository.sumReturnedCostBetween(start, end)));
            points.add(new DailyPoint(day, saleRepository.countValidatedBetween(start, end), revenue, revenue.subtract(cost)));
        }
        return points;
    }

    public ReportSummaryResponse today() {
        LocalDate today = LocalDate.now();
        return summary(today, today);
    }

    /** Du lundi au dimanche de la semaine en cours. */
    public ReportSummaryResponse thisWeek() {
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return summary(monday, monday.plusDays(6));
    }

    public ReportSummaryResponse thisMonth() {
        LocalDate today = LocalDate.now();
        return summary(today.withDayOfMonth(1), today.with(TemporalAdjusters.lastDayOfMonth()));
    }

    // Une somme sans résultat renvoie null : on la remplace par 0
    private BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
