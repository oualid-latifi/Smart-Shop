package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Sale;
import smartshop.entity.SaleLine;
import smartshop.entity.SaleStatus;
import smartshop.repository.SaleRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Analyses du tableau de bord : tendances, moments forts, marge par marque, prévision du mois. */
@Service
public class InsightsService {

    public record Period(BigDecimal revenue, BigDecimal profit, long sales) {
    }

    /** Ce mois-ci jusqu'à aujourd'hui, comparé au même nombre de jours du mois précédent. */
    public record MonthComparison(Period current, Period previous, Integer revenueChangePercent, Integer profitChangePercent) {
    }

    public record Forecast(BigDecimal revenueSoFar, BigDecimal projectedRevenue, int daysElapsed, int daysInMonth) {
    }

    public record Bucket(int index, BigDecimal revenue, long sales) {
    }

    public record BrandMargin(String brand, BigDecimal revenue, BigDecimal cost, BigDecimal margin, BigDecimal marginPercent, int units) {
    }

    public record Insights(MonthComparison month, Forecast forecast, List<Bucket> byWeekday, List<Bucket> byHour,
                           List<BrandMargin> byBrand, LocalDate analysisFrom, LocalDate analysisTo) {
    }

    private final SaleRepository saleRepository;

    public InsightsService(SaleRepository saleRepository) {
        this.saleRepository = saleRepository;
    }

    /** Moments forts et marge par marque calculés sur les "days" derniers jours (90 par défaut). */
    @Transactional(readOnly = true)
    public Insights insights(int days) {
        LocalDate today = LocalDate.now();
        int period = Math.min(Math.max(days, 7), 365);

        // Mois en cours comparé au début du mois précédent (même nombre de jours)
        LocalDate monthStart = today.withDayOfMonth(1);
        int elapsed = today.getDayOfMonth();
        Period current = sum(sales(monthStart, today));
        LocalDate prevStart = monthStart.minusMonths(1);
        LocalDate prevEnd = prevStart.plusDays(Math.min(elapsed, YearMonth.from(prevStart).lengthOfMonth()) - 1);
        Period previous = sum(sales(prevStart, prevEnd));
        MonthComparison month = new MonthComparison(current, previous,
                change(current.revenue(), previous.revenue()), change(current.profit(), previous.profit()));

        int daysInMonth = YearMonth.from(today).lengthOfMonth();
        BigDecimal projected = current.revenue().multiply(BigDecimal.valueOf(daysInMonth)).divide(BigDecimal.valueOf(elapsed), 2, RoundingMode.HALF_UP);
        Forecast forecast = new Forecast(current.revenue(), projected, elapsed, daysInMonth);

        // Jours de la semaine (1 = lundi … 7 = dimanche) et heures (0-23)
        LocalDate from = today.minusDays(period - 1L);
        List<Sale> recent = sales(from, today);
        BigDecimal[] weekday = zeros(8);
        long[] weekdayCount = new long[8];
        BigDecimal[] hour = zeros(24);
        long[] hourCount = new long[24];
        Map<String, BigDecimal[]> brands = new LinkedHashMap<>(); // [CA, coût, unités]
        for (Sale s : recent) {
            int d = s.getSaleDate().getDayOfWeek().getValue();
            int h = s.getSaleDate().getHour();
            weekday[d] = weekday[d].add(s.getNetTotal());
            weekdayCount[d]++;
            hour[h] = hour[h].add(s.getNetTotal());
            hourCount[h]++;
            for (SaleLine l : s.getLines()) {
                String brand = l.getProduct().getBrand() != null && !l.getProduct().getBrand().isBlank() ? l.getProduct().getBrand().trim() : "Sans marque";
                BigDecimal[] acc = brands.computeIfAbsent(brand, k -> zeros(3));
                acc[0] = acc[0].add(l.getLineTotal());
                acc[1] = acc[1].add(l.getUnitCost().multiply(BigDecimal.valueOf(l.getQuantity())));
                acc[2] = acc[2].add(BigDecimal.valueOf(l.getQuantity()));
            }
        }
        List<Bucket> byWeekday = new ArrayList<>();
        for (int d = 1; d <= 7; d++) byWeekday.add(new Bucket(d, weekday[d], weekdayCount[d]));
        List<Bucket> byHour = new ArrayList<>();
        for (int h = 0; h < 24; h++) byHour.add(new Bucket(h, hour[h], hourCount[h]));
        List<BrandMargin> byBrand = new ArrayList<>();
        brands.forEach((brand, acc) -> {
            BigDecimal margin = acc[0].subtract(acc[1]);
            BigDecimal pct = acc[0].signum() > 0 ? margin.multiply(BigDecimal.valueOf(100)).divide(acc[0], 1, RoundingMode.HALF_UP) : BigDecimal.ZERO;
            byBrand.add(new BrandMargin(brand, acc[0], acc[1], margin, pct, acc[2].intValue()));
        });
        byBrand.sort(Comparator.comparing(BrandMargin::revenue).reversed());

        return new Insights(month, forecast, byWeekday, byHour, byBrand, from, today);
    }

    private List<Sale> sales(LocalDate from, LocalDate to) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        return saleRepository.findBySaleDateGreaterThanEqualAndSaleDateLessThanOrderBySaleDateAsc(start, end).stream()
                .filter(s -> s.getStatus() == SaleStatus.VALIDATED).toList();
    }

    private static Period sum(List<Sale> sales) {
        BigDecimal revenue = sales.stream().map(Sale::getNetTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal profit = sales.stream().map(Sale::getProfit).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Period(revenue, profit, sales.size());
    }

    private static Integer change(BigDecimal current, BigDecimal previous) {
        if (previous.signum() <= 0) return null;
        return current.subtract(previous).multiply(BigDecimal.valueOf(100)).divide(previous, 0, RoundingMode.HALF_UP).intValue();
    }

    private static BigDecimal[] zeros(int n) {
        BigDecimal[] arr = new BigDecimal[n];
        java.util.Arrays.fill(arr, BigDecimal.ZERO);
        return arr;
    }
}
