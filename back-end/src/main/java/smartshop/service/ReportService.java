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

    public ReportService(SaleRepository saleRepository,
                         SaleLineRepository saleLineRepository,
                         CustomerPaymentRepository customerPaymentRepository,
                         PurchaseRepository purchaseRepository,
                         PurchasePaymentRepository purchasePaymentRepository,
                         ExpenseRepository expenseRepository,
                         ProductRepository productRepository) {
        this.saleRepository = saleRepository;
        this.saleLineRepository = saleLineRepository;
        this.customerPaymentRepository = customerPaymentRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchasePaymentRepository = purchasePaymentRepository;
        this.expenseRepository = expenseRepository;
        this.productRepository = productRepository;
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
        BigDecimal cost = nz(saleLineRepository.sumCostBetween(startTime, endTime));
        BigDecimal grossProfit = revenue.subtract(cost);

        BigDecimal expenses = nz(expenseRepository.sumBetween(start, end));
        BigDecimal netProfit = grossProfit.subtract(expenses);

        BigDecimal cashCollected = nz(customerPaymentRepository.sumValidatedBetween(startTime, endTime))
                .add(nz(saleRepository.sumWalkInPaidBetween(startTime, endTime)));
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
                nz(productRepository.sumStockValue()),
                productRepository.countLowStock());
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
