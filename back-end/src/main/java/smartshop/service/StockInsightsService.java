package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Product;
import smartshop.entity.Purchase;
import smartshop.entity.PurchaseLine;
import smartshop.entity.Sale;
import smartshop.entity.SaleLine;
import smartshop.entity.SaleStatus;
import smartshop.entity.Supplier;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.ProductRepository;
import smartshop.repository.PurchaseRepository;
import smartshop.repository.SaleRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Aide aux achats : réapprovisionnement, stock dormant, comparaison des prix fournisseurs. */
@Service
public class StockInsightsService {

    public record Replenishment(UUID productId, String reference, String name, int stock, int alertThreshold,
                                int soldInPeriod, BigDecimal dailyAverage, Integer daysOfCover, int suggestedQuantity,
                                UUID lastSupplierId, String lastSupplierName, BigDecimal lastPurchasePrice) {
    }

    public record Dormant(UUID productId, String reference, String name, int stock, BigDecimal stockValue,
                          LocalDateTime lastSaleDate, Integer daysWithoutSale) {
    }

    public record SupplierPrice(UUID supplierId, String supplierName, BigDecimal lastPrice, BigDecimal minPrice,
                                BigDecimal averagePrice, int purchases, int totalQuantity, LocalDateTime lastPurchaseDate,
                                boolean cheapest) {
    }

    private final ProductRepository productRepository;
    private final SaleRepository saleRepository;
    private final PurchaseRepository purchaseRepository;

    public StockInsightsService(ProductRepository productRepository, SaleRepository saleRepository, PurchaseRepository purchaseRepository) {
        this.productRepository = productRepository;
        this.saleRepository = saleRepository;
        this.purchaseRepository = purchaseRepository;
    }

    /**
     * Quantité à commander pour couvrir "coverDays" jours de ventes, d'après le rythme des "days" derniers jours,
     * en gardant le seuil d'alerte en réserve. Seuls les produits à commander sont renvoyés.
     */
    @Transactional(readOnly = true)
    public List<Replenishment> replenishment(int days, int coverDays) {
        int period = clamp(days, 7, 365);
        int cover = clamp(coverDays, 1, 180);
        LocalDateTime now = LocalDateTime.now();
        Map<UUID, Integer> sold = soldUnits(now.minusDays(period), now);
        Map<UUID, PurchaseLine> lastPurchase = lastPurchaseLines();

        List<Replenishment> result = new ArrayList<>();
        for (Product p : productRepository.findByActiveTrue()) {
            int qty = sold.getOrDefault(p.getId(), 0);
            BigDecimal daily = BigDecimal.valueOf(qty).divide(BigDecimal.valueOf(period), 2, RoundingMode.HALF_UP);
            int need = (int) Math.ceil(daily.doubleValue() * cover) + p.getAlertThreshold() - p.getStockQuantity();
            // Rien vendu et stock au-dessus du seuil : pas besoin de commander
            if (need <= 0) continue;
            Integer daysOfCover = daily.signum() > 0 ? (int) Math.floor(Math.max(0, p.getStockQuantity()) / daily.doubleValue()) : null;
            PurchaseLine last = lastPurchase.get(p.getId());
            Supplier supplier = last != null ? last.getPurchase().getSupplier() : null;
            result.add(new Replenishment(p.getId(), p.getReference(), p.getName(), p.getStockQuantity(), p.getAlertThreshold(),
                    qty, daily, daysOfCover, need,
                    supplier != null ? supplier.getId() : null, supplier != null ? supplier.getName() : null,
                    last != null ? last.getUnitPrice() : p.getAveragePurchasePrice()));
        }
        // Les plus urgents d'abord (moins de jours de stock)
        result.sort(Comparator.comparing((Replenishment r) -> r.daysOfCover() == null ? Integer.MAX_VALUE : r.daysOfCover())
                .thenComparing(Replenishment::suggestedQuantity, Comparator.reverseOrder()));
        return result;
    }

    /** Produits en stock qui ne se sont pas vendus depuis au moins "days" jours. */
    @Transactional(readOnly = true)
    public List<Dormant> dormant(int days) {
        int threshold = clamp(days, 7, 3650);
        LocalDateTime now = LocalDateTime.now();
        Map<UUID, LocalDateTime> lastSale = new HashMap<>();
        for (Sale s : saleRepository.findAllByOrderBySaleDateDesc()) {
            if (s.getStatus() != SaleStatus.VALIDATED) continue;
            for (SaleLine l : s.getLines()) lastSale.putIfAbsent(l.getProduct().getId(), s.getSaleDate());
        }
        List<Dormant> result = new ArrayList<>();
        for (Product p : productRepository.findByActiveTrue()) {
            if (p.getStockQuantity() <= 0) continue;
            LocalDateTime last = lastSale.get(p.getId());
            Integer idle = last != null ? (int) ChronoUnit.DAYS.between(last, now) : null;
            boolean dormant = last == null ? p.getCreatedAt() == null || p.getCreatedAt().isBefore(now.minusDays(threshold)) : idle >= threshold;
            if (!dormant) continue;
            result.add(new Dormant(p.getId(), p.getReference(), p.getName(), p.getStockQuantity(),
                    p.getAveragePurchasePrice().multiply(BigDecimal.valueOf(p.getStockQuantity())), last, idle));
        }
        result.sort(Comparator.comparing(Dormant::stockValue).reversed());
        return result;
    }

    /** Historique des prix d'achat d'un produit, fournisseur par fournisseur. */
    @Transactional(readOnly = true)
    public List<SupplierPrice> supplierPrices(UUID productId) {
        productRepository.findById(productId).orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
        Map<String, List<PurchaseLine>> bySupplier = new LinkedHashMap<>();
        Map<String, Supplier> suppliers = new HashMap<>();
        for (Purchase purchase : purchaseRepository.findAllByOrderByPurchaseDateDesc()) {
            for (PurchaseLine l : purchase.getLines()) {
                if (!l.getProduct().getId().equals(productId)) continue;
                Supplier s = purchase.getSupplier();
                String key = s != null ? s.getId().toString() : "none";
                bySupplier.computeIfAbsent(key, k -> new ArrayList<>()).add(l);
                if (s != null) suppliers.put(key, s);
            }
        }
        List<SupplierPrice> result = new ArrayList<>();
        for (Map.Entry<String, List<PurchaseLine>> e : bySupplier.entrySet()) {
            List<PurchaseLine> lines = e.getValue(); // du plus récent au plus ancien
            int qty = lines.stream().mapToInt(PurchaseLine::getQuantity).sum();
            BigDecimal spent = lines.stream().map(l -> l.getUnitPrice().multiply(BigDecimal.valueOf(l.getQuantity()))).reduce(BigDecimal.ZERO, BigDecimal::add);
            Supplier s = suppliers.get(e.getKey());
            result.add(new SupplierPrice(s != null ? s.getId() : null, s != null ? s.getName() : "Sans fournisseur",
                    lines.get(0).getUnitPrice(),
                    lines.stream().map(PurchaseLine::getUnitPrice).min(Comparator.naturalOrder()).orElse(BigDecimal.ZERO),
                    qty > 0 ? spent.divide(BigDecimal.valueOf(qty), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                    lines.size(), qty, lines.get(0).getPurchase().getPurchaseDate(), false));
        }
        result.sort(Comparator.comparing(SupplierPrice::lastPrice));
        if (!result.isEmpty()) {
            SupplierPrice first = result.get(0);
            result.set(0, new SupplierPrice(first.supplierId(), first.supplierName(), first.lastPrice(), first.minPrice(),
                    first.averagePrice(), first.purchases(), first.totalQuantity(), first.lastPurchaseDate(), true));
        }
        return result;
    }

    private Map<UUID, Integer> soldUnits(LocalDateTime start, LocalDateTime end) {
        Map<UUID, Integer> sold = new HashMap<>();
        for (Sale s : saleRepository.findBySaleDateGreaterThanEqualAndSaleDateLessThanOrderBySaleDateAsc(start, end)) {
            if (s.getStatus() != SaleStatus.VALIDATED) continue;
            for (SaleLine l : s.getLines()) sold.merge(l.getProduct().getId(), l.getQuantity(), Integer::sum);
        }
        return sold;
    }

    private Map<UUID, PurchaseLine> lastPurchaseLines() {
        Map<UUID, PurchaseLine> last = new HashMap<>();
        for (Purchase p : purchaseRepository.findAllByOrderByPurchaseDateDesc()) {
            for (PurchaseLine l : p.getLines()) last.putIfAbsent(l.getProduct().getId(), l);
        }
        return last;
    }

    private static int clamp(int value, int min, int max) {
        return Math.min(Math.max(value, min), max);
    }
}
