package smartshop.service;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.ReportSummaryResponse;
import smartshop.entity.Customer;
import smartshop.entity.Expense;
import smartshop.entity.PaymentMethod;
import smartshop.entity.Product;
import smartshop.entity.Purchase;
import smartshop.entity.Sale;
import smartshop.entity.SaleLine;
import smartshop.entity.SaleStatus;
import smartshop.entity.ShopSettings;
import smartshop.repository.CustomerRepository;
import smartshop.repository.ExpenseRepository;
import smartshop.repository.ProductRepository;
import smartshop.repository.PurchaseRepository;
import smartshop.repository.SaleRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Rapport Excel détaillé sur une période, avec les vraies données :
 * synthèse, ventes, lignes vendues, produits, clients, achats de chaque client, dépenses, achats fournisseurs.
 * Chaque onglet a des filtres, des en-têtes figés et une ligne de totaux en formules Excel.
 */
@Service
public class ExcelReportService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ReportService reportService;
    private final ShopSettingsService settingsService;
    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final ExpenseRepository expenseRepository;
    private final PurchaseRepository purchaseRepository;

    public ExcelReportService(ReportService reportService, ShopSettingsService settingsService,
                              SaleRepository saleRepository, ProductRepository productRepository,
                              CustomerRepository customerRepository, ExpenseRepository expenseRepository,
                              PurchaseRepository purchaseRepository) {
        this.reportService = reportService;
        this.settingsService = settingsService;
        this.saleRepository = saleRepository;
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.expenseRepository = expenseRepository;
        this.purchaseRepository = purchaseRepository;
    }

    @Transactional(readOnly = true)
    public byte[] build(LocalDate from, LocalDate to) throws IOException {
        ReportSummaryResponse summary = reportService.summary(from, to);
        LocalDateTime start = summary.from().atStartOfDay();
        LocalDateTime end = summary.to().plusDays(1).atStartOfDay();
        List<Sale> sales = saleRepository.findBySaleDateGreaterThanEqualAndSaleDateLessThanOrderBySaleDateAsc(start, end);
        List<Sale> validated = sales.stream().filter(s -> s.getStatus() == SaleStatus.VALIDATED).toList();

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Styles st = new Styles(wb);
            summarySheet(wb, st, summary, validated);
            salesSheet(wb, st, sales);
            linesSheet(wb, st, validated);
            productsSheet(wb, st, validated);
            customersSheet(wb, st, validated);
            customerProductsSheet(wb, st, validated);
            expensesSheet(wb, st, expenseRepository.findByExpenseDateBetweenOrderByExpenseDateDescCreatedAtDesc(summary.from(), summary.to()));
            purchasesSheet(wb, st, purchaseRepository.findByPurchaseDateGreaterThanEqualAndPurchaseDateLessThanOrderByPurchaseDateAsc(start, end));
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ---------------------------------------------------------------- Onglets

    private void summarySheet(XSSFWorkbook wb, Styles st, ReportSummaryResponse r, List<Sale> sales) {
        Sheet sh = wb.createSheet("Synthèse");
        ShopSettings settings = settingsService.get();
        sh.setColumnWidth(0, 38 * 256);
        sh.setColumnWidth(1, 22 * 256);
        sh.setColumnWidth(2, 4 * 256);
        sh.setColumnWidth(3, 26 * 256);
        sh.setColumnWidth(4, 18 * 256);
        sh.setColumnWidth(5, 14 * 256);

        int row = 0;
        cell(sh, row, 0, settings.getShopName() != null ? settings.getShopName() : "SmartShop", st.title);
        row++;
        cell(sh, row, 0, "Rapport d'activité du " + DATE.format(r.from()) + " au " + DATE.format(r.to()), st.subtitle);
        row++;
        cell(sh, row, 0, "Généré le " + DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm").format(LocalDateTime.now()), st.muted);
        row += 2;

        cell(sh, row, 0, "ACTIVITÉ DE LA PÉRIODE", st.section);
        sh.addMergedRegion(new CellRangeAddress(row, row, 0, 1));
        row++;
        row = kpi(sh, st, row, "Nombre de ventes", r.salesCount(), false);
        row = kpi(sh, st, row, "Chiffre d'affaires (net des retours)", r.revenue(), true);
        row = kpi(sh, st, row, "Coût d'achat des produits vendus", r.costOfGoodsSold(), true);
        row = kpi(sh, st, row, "Marge brute", r.grossProfit(), true);
        Row rateRow = sh.createRow(row++);
        cell(rateRow, 0, "Taux de marge", st.label);
        Cell rate = rateRow.createCell(1);
        rate.setCellValue(r.revenue().signum() > 0 ? r.grossProfit().divide(r.revenue(), 4, RoundingMode.HALF_UP).doubleValue() : 0);
        rate.setCellStyle(st.percentBold);
        row = kpi(sh, st, row, "Dépenses", r.expenses(), true);
        row = kpiHighlight(sh, st, row, "Bénéfice net", r.netProfit());
        row++;

        cell(sh, row, 0, "TRÉSORERIE", st.section);
        sh.addMergedRegion(new CellRangeAddress(row, row, 0, 1));
        row++;
        row = kpi(sh, st, row, "Argent encaissé", r.cashCollected(), true);
        row = kpi(sh, st, row, "Payé aux fournisseurs", r.paidToSuppliers(), true);
        row = kpi(sh, st, row, "Achats de marchandise", r.purchasesTotal(), true);
        row = kpiHighlight(sh, st, row, "Flux de trésorerie net", r.netCashFlow());
        row++;

        cell(sh, row, 0, "SITUATION À CE JOUR", st.section);
        sh.addMergedRegion(new CellRangeAddress(row, row, 0, 1));
        row++;
        row = kpi(sh, st, row, "Dettes des clients (crédit)", r.totalCustomerDebt(), true);
        row = kpi(sh, st, row, "Dettes envers les fournisseurs", r.totalSupplierDebt(), true);
        row = kpi(sh, st, row, "Valeur du stock (prix d'achat)", r.stockValue(), true);
        kpi(sh, st, row, "Produits en stock bas", r.lowStockCount(), false);

        // Tableaux de répartition à droite
        int right = 4;
        cell(sh, right, 3, "VENTES PAR MODE DE PAIEMENT", st.section);
        sh.addMergedRegion(new CellRangeAddress(right, right, 3, 5));
        right++;
        right = smallHeader(sh, st, right, "Mode", "Montant", "Ventes");
        Map<PaymentMethod, List<Sale>> byMethod = sales.stream().collect(Collectors.groupingBy(Sale::getPaymentMethod, LinkedHashMap::new, Collectors.toList()));
        for (Map.Entry<PaymentMethod, List<Sale>> e : byMethod.entrySet()) {
            right = smallRow(sh, st, right, methodLabel(e.getKey()), sum(e.getValue(), Sale::getNetTotal), e.getValue().size());
        }
        right += 2;
        cell(sh, right, 3, "VENTES PAR VENDEUR", st.section);
        sh.addMergedRegion(new CellRangeAddress(right, right, 3, 5));
        right++;
        right = smallHeader(sh, st, right, "Vendeur", "Montant", "Ventes");
        Map<String, List<Sale>> bySeller = sales.stream().collect(Collectors.groupingBy(
                s -> s.getSeller() != null ? s.getSeller().getName() : "—", LinkedHashMap::new, Collectors.toList()));
        for (Map.Entry<String, List<Sale>> e : bySeller.entrySet()) {
            right = smallRow(sh, st, right, e.getKey(), sum(e.getValue(), Sale::getNetTotal), e.getValue().size());
        }
        right += 2;
        cell(sh, right, 3, "MEILLEURES VENTES", st.section);
        sh.addMergedRegion(new CellRangeAddress(right, right, 3, 5));
        right++;
        right = smallHeader(sh, st, right, "Produit", "Chiffre d'affaires", "Quantité");
        for (var top : r.topProducts()) right = smallRow(sh, st, right, top.name(), top.revenue(), top.quantitySold());
    }

    private void salesSheet(XSSFWorkbook wb, Styles st, List<Sale> sales) {
        Sheet sh = wb.createSheet("Ventes");
        String[] headers = {"N° vente", "Date", "Client", "Téléphone", "Vendeur", "Mode de paiement", "Articles",
                "Sous-total", "Remise", "Total", "Retours", "Total net", "Payé", "Reste dû", "Bénéfice", "Statut", "N° facture"};
        int[] widths = {16, 17, 24, 14, 16, 17, 9, 13, 11, 13, 11, 13, 13, 12, 13, 11, 16};
        header(sh, st, headers, widths);
        int row = 1;
        for (Sale s : sales) {
            Row r = sh.createRow(row++);
            boolean cancelled = s.getStatus() == SaleStatus.CANCELLED;
            cell(r, 0, s.getDisplayNumber(), st.text);
            date(r, 1, s.getSaleDate(), st.dateTime);
            cell(r, 2, s.getCustomer() != null ? s.getCustomer().getName() : "Client de passage", st.text);
            cell(r, 3, s.getCustomer() != null ? s.getCustomer().getPhone() : null, st.text);
            cell(r, 4, s.getSeller() != null ? s.getSeller().getName() : null, st.text);
            cell(r, 5, methodLabel(s.getPaymentMethod()), st.text);
            number(r, 6, s.getLines().stream().mapToInt(SaleLine::getQuantity).sum(), st.integer);
            money(r, 7, s.getTotal().add(s.getDiscount()), st);
            money(r, 8, s.getDiscount(), st);
            money(r, 9, s.getTotal(), st);
            money(r, 10, s.getReturnedAmount(), st);
            money(r, 11, cancelled ? BigDecimal.ZERO : s.getNetTotal(), st);
            money(r, 12, s.getAmountPaid(), st);
            money(r, 13, cancelled ? BigDecimal.ZERO : s.getRemaining().max(BigDecimal.ZERO), st);
            money(r, 14, cancelled ? BigDecimal.ZERO : s.getProfit(), st);
            cell(r, 15, cancelled ? "Annulée" : "Validée", cancelled ? st.danger : st.text);
            cell(r, 16, s.getInvoiceNumber(), st.text);
        }
        totals(sh, st, row, headers.length, new int[]{7, 8, 9, 10, 11, 12, 13, 14}, new int[]{6});
    }

    private void linesSheet(XSSFWorkbook wb, Styles st, List<Sale> sales) {
        Sheet sh = wb.createSheet("Détail des ventes");
        String[] headers = {"Date", "N° vente", "Client", "Référence", "Produit", "Marque", "Vendu au", "Quantité",
                "Prix unitaire", "Total ligne", "Coût unitaire", "Coût total", "Marge", "Retournés"};
        int[] widths = {17, 16, 24, 14, 30, 13, 10, 10, 13, 13, 13, 13, 13, 11};
        header(sh, st, headers, widths);
        int row = 1;
        for (Sale s : sales) {
            for (SaleLine l : s.getLines()) {
                Product p = l.getProduct();
                Row r = sh.createRow(row++);
                date(r, 0, s.getSaleDate(), st.dateTime);
                cell(r, 1, s.getDisplayNumber(), st.text);
                cell(r, 2, s.getCustomer() != null ? s.getCustomer().getName() : "Client de passage", st.text);
                cell(r, 3, p.getReference(), st.text);
                cell(r, 4, productName(p), st.text);
                cell(r, 5, p.getBrand(), st.text);
                cell(r, 6, l.getPackCount() != null ? l.getPackCount() + " carton(s)" : "Unité", st.text);
                number(r, 7, l.getQuantity(), st.integer);
                money(r, 8, l.getUnitPrice(), st);
                money(r, 9, l.getLineTotal(), st);
                money(r, 10, l.getUnitCost(), st);
                BigDecimal cost = l.getUnitCost().multiply(BigDecimal.valueOf(l.getQuantity()));
                money(r, 11, cost, st);
                money(r, 12, l.getLineTotal().subtract(cost), st);
                number(r, 13, s.getReturnedQuantity(p.getId()), st.integer);
            }
        }
        totals(sh, st, row, headers.length, new int[]{9, 11, 12}, new int[]{7, 13});
    }

    private void productsSheet(XSSFWorkbook wb, Styles st, List<Sale> sales) {
        Sheet sh = wb.createSheet("Produits");
        String[] headers = {"Référence", "Produit", "Marque", "Code-barres", "Qté vendue", "Chiffre d'affaires", "Coût",
                "Marge", "Taux de marge", "Prix de vente", "Prix d'achat moyen", "Stock actuel", "Valeur du stock", "Seuil d'alerte", "État du stock"};
        int[] widths = {14, 30, 13, 16, 11, 16, 13, 13, 12, 13, 15, 12, 15, 12, 14};
        header(sh, st, headers, widths);

        // Ventes de la période par produit (quantités nettes des retours)
        Map<UUID, BigDecimal[]> sold = new LinkedHashMap<>(); // [quantité, CA, coût]
        for (Sale s : sales) {
            for (SaleLine l : s.getLines()) {
                BigDecimal[] acc = sold.computeIfAbsent(l.getProduct().getId(), k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
                acc[0] = acc[0].add(BigDecimal.valueOf(l.getQuantity()));
                acc[1] = acc[1].add(l.getLineTotal());
                acc[2] = acc[2].add(l.getUnitCost().multiply(BigDecimal.valueOf(l.getQuantity())));
            }
            for (var ret : s.getReturns()) {
                for (var rl : ret.getLines()) {
                    BigDecimal[] acc = sold.get(rl.getProduct().getId());
                    if (acc == null) continue;
                    acc[0] = acc[0].subtract(BigDecimal.valueOf(rl.getQuantity()));
                    acc[1] = acc[1].subtract(rl.getUnitPrice().multiply(BigDecimal.valueOf(rl.getQuantity())));
                    acc[2] = acc[2].subtract(rl.getUnitCost().multiply(BigDecimal.valueOf(rl.getQuantity())));
                }
            }
        }

        List<Product> products = new ArrayList<>(productRepository.findAll());
        products.removeIf(p -> !p.getActive() && !sold.containsKey(p.getId()));
        // Les plus vendus d'abord
        products.sort(Comparator.comparing((Product p) -> sold.containsKey(p.getId()) ? sold.get(p.getId())[1] : BigDecimal.ZERO).reversed());

        int row = 1;
        for (Product p : products) {
            BigDecimal[] acc = sold.getOrDefault(p.getId(), new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            Row r = sh.createRow(row++);
            cell(r, 0, p.getReference(), st.text);
            cell(r, 1, productName(p), st.text);
            cell(r, 2, p.getBrand(), st.text);
            cell(r, 3, p.getBarcode(), st.text);
            number(r, 4, acc[0].intValue(), st.integer);
            money(r, 5, acc[1], st);
            money(r, 6, acc[2], st);
            int excelRow = row; // numéro de ligne Excel (1-based) de cette ligne
            formula(r, 7, "F" + excelRow + "-G" + excelRow, st.money);
            formula(r, 8, "IF(F" + excelRow + "=0,0,H" + excelRow + "/F" + excelRow + ")", st.percent);
            money(r, 9, p.getSalePrice(), st);
            money(r, 10, p.getAveragePurchasePrice(), st);
            number(r, 11, p.getStockQuantity(), st.integer);
            formula(r, 12, "MAX(0,L" + excelRow + ")*K" + excelRow, st.money);
            number(r, 13, p.getAlertThreshold(), st.integer);
            String state = !p.getActive() ? "Désactivé" : p.getStockQuantity() <= 0 ? "Rupture"
                    : p.getStockQuantity() <= p.getAlertThreshold() ? "Stock bas" : "OK";
            cell(r, 14, state, state.equals("OK") ? st.success : state.equals("Désactivé") ? st.text : st.danger);
        }
        totals(sh, st, row, headers.length, new int[]{5, 6, 7, 12}, new int[]{4, 11});
    }

    private void customersSheet(XSSFWorkbook wb, Styles st, List<Sale> sales) {
        Sheet sh = wb.createSheet("Clients");
        String[] headers = {"Client", "Téléphone", "Adresse", "ICE", "Achats (période)", "Montant acheté", "Montant payé",
                "Dette actuelle", "Plafond de crédit", "Dernier achat", "Produits achetés"};
        int[] widths = {26, 14, 28, 17, 14, 15, 15, 14, 15, 15, 60};
        header(sh, st, headers, widths);

        Map<UUID, List<Sale>> byCustomer = sales.stream().filter(s -> s.getCustomer() != null)
                .collect(Collectors.groupingBy(s -> s.getCustomer().getId()));
        List<Customer> customers = customerRepository.findAll().stream()
                .map(c -> Map.entry(c, debtOf(c.getId())))
                .filter(e -> byCustomer.containsKey(e.getKey().getId()) || e.getValue().signum() > 0)
                .sorted(Comparator.comparing((Map.Entry<Customer, BigDecimal> e) -> sum(byCustomer.getOrDefault(e.getKey().getId(), List.of()), Sale::getNetTotal)).reversed())
                .map(Map.Entry::getKey)
                .toList();

        int row = 1;
        for (Customer c : customers) {
            List<Sale> theirs = byCustomer.getOrDefault(c.getId(), List.of());
            Row r = sh.createRow(row++);
            cell(r, 0, c.getName(), st.textBold);
            cell(r, 1, c.getPhone(), st.text);
            cell(r, 2, c.getAddress(), st.text);
            cell(r, 3, c.getIce(), st.text);
            number(r, 4, theirs.size(), st.integer);
            money(r, 5, sum(theirs, Sale::getNetTotal), st);
            money(r, 6, sum(theirs, Sale::getAmountPaid), st);
            BigDecimal debt = debtOf(c.getId());
            Cell d = r.createCell(7);
            d.setCellValue(debt.doubleValue());
            d.setCellStyle(debt.signum() > 0 ? st.moneyDanger : st.money);
            if (c.getCreditLimit() != null) money(r, 8, c.getCreditLimit(), st);
            theirs.stream().map(Sale::getSaleDate).max(Comparator.naturalOrder()).ifPresent(dt -> date(r, 9, dt, st.date));
            cell(r, 10, productsSummary(theirs), st.wrap);
        }
        totals(sh, st, row, headers.length, new int[]{5, 6, 7}, new int[]{4});
    }

    private void customerProductsSheet(XSSFWorkbook wb, Styles st, List<Sale> sales) {
        Sheet sh = wb.createSheet("Achats par client");
        String[] headers = {"Client", "Téléphone", "Référence", "Produit", "Marque", "Quantité", "Montant", "Prix moyen", "Nombre d'achats", "Premier achat", "Dernier achat"};
        int[] widths = {26, 14, 14, 30, 13, 10, 14, 13, 14, 14, 14};
        header(sh, st, headers, widths);

        record Key(UUID customer, UUID product) {
        }
        class Acc {
            Customer customer;
            Product product;
            int quantity;
            BigDecimal amount = BigDecimal.ZERO;
            final java.util.Set<UUID> saleIds = new java.util.HashSet<>();
            LocalDateTime first;
            LocalDateTime last;
        }
        Map<Key, Acc> map = new LinkedHashMap<>();
        for (Sale s : sales) {
            if (s.getCustomer() == null) continue;
            for (SaleLine l : s.getLines()) {
                Acc a = map.computeIfAbsent(new Key(s.getCustomer().getId(), l.getProduct().getId()), k -> new Acc());
                a.customer = s.getCustomer();
                a.product = l.getProduct();
                a.quantity += l.getQuantity();
                a.amount = a.amount.add(l.getLineTotal());
                a.saleIds.add(s.getId());
                if (a.first == null || s.getSaleDate().isBefore(a.first)) a.first = s.getSaleDate();
                if (a.last == null || s.getSaleDate().isAfter(a.last)) a.last = s.getSaleDate();
            }
            for (var ret : s.getReturns()) {
                for (var rl : ret.getLines()) {
                    Acc a = map.get(new Key(s.getCustomer().getId(), rl.getProduct().getId()));
                    if (a == null) continue;
                    a.quantity -= rl.getQuantity();
                    a.amount = a.amount.subtract(rl.getUnitPrice().multiply(BigDecimal.valueOf(rl.getQuantity())));
                }
            }
        }
        List<Acc> rows = new ArrayList<>(map.values());
        rows.sort(Comparator.comparing((Acc a) -> a.customer.getName()).thenComparing((Acc a) -> a.amount, Comparator.reverseOrder()));

        int row = 1;
        for (Acc a : rows) {
            Row r = sh.createRow(row++);
            cell(r, 0, a.customer.getName(), st.textBold);
            cell(r, 1, a.customer.getPhone(), st.text);
            cell(r, 2, a.product.getReference(), st.text);
            cell(r, 3, productName(a.product), st.text);
            cell(r, 4, a.product.getBrand(), st.text);
            number(r, 5, a.quantity, st.integer);
            money(r, 6, a.amount, st);
            int excelRow = row;
            formula(r, 7, "IF(F" + excelRow + "=0,0,G" + excelRow + "/F" + excelRow + ")", st.money);
            number(r, 8, a.saleIds.size(), st.integer);
            date(r, 9, a.first, st.date);
            date(r, 10, a.last, st.date);
        }
        totals(sh, st, row, headers.length, new int[]{6}, new int[]{5, 8});
    }

    private void expensesSheet(XSSFWorkbook wb, Styles st, List<Expense> expenses) {
        Sheet sh = wb.createSheet("Dépenses");
        String[] headers = {"Date", "Catégorie", "Montant", "Note"};
        header(sh, st, headers, new int[]{14, 18, 14, 50});
        int row = 1;
        for (Expense e : expenses) {
            Row r = sh.createRow(row++);
            date(r, 0, e.getExpenseDate().atStartOfDay(), st.date);
            cell(r, 1, expenseLabel(e.getCategory().name()), st.text);
            money(r, 2, e.getAmount(), st);
            cell(r, 3, e.getNote(), st.text);
        }
        totals(sh, st, row, headers.length, new int[]{2}, new int[]{});
    }

    private void purchasesSheet(XSSFWorkbook wb, Styles st, List<Purchase> purchases) {
        Sheet sh = wb.createSheet("Achats fournisseurs");
        String[] headers = {"Date", "Fournisseur", "Articles", "Total", "Retours", "Payé", "Reste à payer", "Note"};
        header(sh, st, headers, new int[]{17, 24, 10, 14, 12, 14, 14, 40});
        int row = 1;
        for (Purchase p : purchases) {
            Row r = sh.createRow(row++);
            date(r, 0, p.getPurchaseDate(), st.dateTime);
            cell(r, 1, p.getSupplier() != null ? p.getSupplier().getName() : "—", st.text);
            number(r, 2, p.getLines().stream().mapToInt(l -> l.getQuantity()).sum(), st.integer);
            money(r, 3, p.getTotal(), st);
            money(r, 4, p.getReturnedAmount(), st);
            money(r, 5, p.getAmountPaid(), st);
            money(r, 6, p.getRemaining().max(BigDecimal.ZERO), st);
            cell(r, 7, p.getNote(), st.text);
        }
        totals(sh, st, row, headers.length, new int[]{3, 4, 5, 6}, new int[]{2});
    }

    // ---------------------------------------------------------------- Aides de mise en forme

    /** Styles partagés par tous les onglets (un classeur est limité en nombre de styles). */
    private static final class Styles {
        final CellStyle title, subtitle, muted, section, label, header, text, textBold, wrap, danger, success,
                integer, money, moneyBold, moneyDanger, percent, percentBold, date, dateTime, totalLabel, totalMoney, totalInt,
                highlightLabel, highlightMoney;

        Styles(XSSFWorkbook wb) {
            CreationHelper helper = wb.getCreationHelper();
            short moneyFormat = helper.createDataFormat().getFormat("#,##0.00 \"DH\";[Red]-#,##0.00 \"DH\"");
            short intFormat = helper.createDataFormat().getFormat("#,##0");
            short pctFormat = helper.createDataFormat().getFormat("0.0%");
            XSSFColor blue = new XSSFColor(new byte[]{(byte) 29, (byte) 79, (byte) 216}, null);
            XSSFColor light = new XSSFColor(new byte[]{(byte) 232, (byte) 239, (byte) 255}, null);
            XSSFColor rule = new XSSFColor(new byte[]{(byte) 220, (byte) 226, (byte) 236}, null);

            title = style(wb, font(wb, 18, true, IndexedColors.DARK_BLUE), null);
            subtitle = style(wb, font(wb, 12, true, IndexedColors.GREY_80_PERCENT), null);
            muted = style(wb, font(wb, 9, false, IndexedColors.GREY_50_PERCENT), null);
            section = style(wb, font(wb, 10, true, IndexedColors.WHITE), blue);
            label = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            header = style(wb, font(wb, 10, true, IndexedColors.WHITE), blue);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            header.setWrapText(true);
            text = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            textBold = bordered(style(wb, font(wb, 10, true, IndexedColors.BLACK), null), rule);
            wrap = bordered(style(wb, font(wb, 9, false, IndexedColors.GREY_80_PERCENT), null), rule);
            wrap.setWrapText(true);
            danger = bordered(style(wb, font(wb, 10, true, IndexedColors.RED), null), rule);
            success = bordered(style(wb, font(wb, 10, true, IndexedColors.GREEN), null), rule);
            integer = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            integer.setDataFormat(intFormat);
            money = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            money.setDataFormat(moneyFormat);
            moneyBold = bordered(style(wb, font(wb, 10, true, IndexedColors.BLACK), null), rule);
            moneyBold.setDataFormat(moneyFormat);
            moneyDanger = bordered(style(wb, font(wb, 10, true, IndexedColors.RED), null), rule);
            moneyDanger.setDataFormat(moneyFormat);
            percent = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            percent.setDataFormat(pctFormat);
            percentBold = bordered(style(wb, font(wb, 10, true, IndexedColors.BLACK), null), rule);
            percentBold.setDataFormat(pctFormat);
            date = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            date.setDataFormat(helper.createDataFormat().getFormat("dd/mm/yyyy"));
            dateTime = bordered(style(wb, font(wb, 10, false, IndexedColors.BLACK), null), rule);
            dateTime.setDataFormat(helper.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
            totalLabel = style(wb, font(wb, 10, true, IndexedColors.DARK_BLUE), light);
            totalMoney = style(wb, font(wb, 10, true, IndexedColors.DARK_BLUE), light);
            totalMoney.setDataFormat(moneyFormat);
            totalInt = style(wb, font(wb, 10, true, IndexedColors.DARK_BLUE), light);
            totalInt.setDataFormat(intFormat);
            highlightLabel = style(wb, font(wb, 11, true, IndexedColors.WHITE), blue);
            highlightMoney = style(wb, font(wb, 11, true, IndexedColors.WHITE), blue);
            highlightMoney.setDataFormat(moneyFormat);
        }

        private static Font font(XSSFWorkbook wb, int size, boolean bold, IndexedColors color) {
            Font f = wb.createFont();
            f.setFontName("Calibri");
            f.setFontHeightInPoints((short) size);
            f.setBold(bold);
            f.setColor(color.getIndex());
            return f;
        }

        private static XSSFCellStyle style(XSSFWorkbook wb, Font font, XSSFColor fill) {
            XSSFCellStyle s = wb.createCellStyle();
            s.setFont(font);
            s.setVerticalAlignment(VerticalAlignment.CENTER);
            if (fill != null) {
                s.setFillForegroundColor(fill);
                s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            }
            return s;
        }

        private static CellStyle bordered(XSSFCellStyle s, XSSFColor color) {
            s.setBorderBottom(BorderStyle.THIN);
            s.setBottomBorderColor(color);
            return s;
        }
    }

    /** Ligne d'en-tête bleue, figée, avec filtres automatiques. */
    private static void header(Sheet sh, Styles st, String[] headers, int[] widths) {
        Row r = sh.createRow(0);
        r.setHeightInPoints(30);
        for (int i = 0; i < headers.length; i++) {
            cell(r, i, headers[i], st.header);
            sh.setColumnWidth(i, widths[i] * 256);
        }
        sh.createFreezePane(0, 1);
        sh.setAutoFilter(new CellRangeAddress(0, 0, 0, headers.length - 1));
    }

    /**
     * Ligne "TOTAL" : SOUS.TOTAL (fonction 9) pour que les totaux suivent les filtres appliqués dans Excel.
     */
    private static void totals(Sheet sh, Styles st, int rowIndex, int columns, int[] moneyColumns, int[] integerColumns) {
        if (rowIndex <= 1) return; // aucune donnée
        Row r = sh.createRow(rowIndex);
        r.setHeightInPoints(20);
        for (int i = 0; i < columns; i++) r.createCell(i).setCellStyle(st.totalLabel);
        r.getCell(0).setCellValue("TOTAL");
        for (int col : moneyColumns) subtotal(r, col, rowIndex, st.totalMoney);
        for (int col : integerColumns) subtotal(r, col, rowIndex, st.totalInt);
    }

    private static void subtotal(Row r, int col, int lastDataRow, CellStyle style) {
        String letter = org.apache.poi.ss.util.CellReference.convertNumToColString(col);
        Cell c = r.getCell(col);
        c.setCellFormula("SUBTOTAL(9," + letter + "2:" + letter + lastDataRow + ")");
        c.setCellStyle(style);
    }

    private static int kpi(Sheet sh, Styles st, int row, String label, Object value, boolean isMoney) {
        Row r = sh.createRow(row);
        r.setHeightInPoints(18);
        cell(r, 0, label, st.label);
        Cell c = r.createCell(1);
        if (value instanceof BigDecimal b) c.setCellValue(b.doubleValue());
        else c.setCellValue(((Number) value).doubleValue());
        c.setCellStyle(isMoney ? st.moneyBold : st.integer);
        return row + 1;
    }

    private static int kpiHighlight(Sheet sh, Styles st, int row, String label, BigDecimal value) {
        Row r = sh.createRow(row);
        r.setHeightInPoints(22);
        cell(r, 0, label, st.highlightLabel);
        Cell c = r.createCell(1);
        c.setCellValue(value.doubleValue());
        c.setCellStyle(st.highlightMoney);
        return row + 1;
    }

    private static int smallHeader(Sheet sh, Styles st, int row, String a, String b, String c) {
        Row r = rowAt(sh, row);
        cell(r, 3, a, st.header);
        cell(r, 4, b, st.header);
        cell(r, 5, c, st.header);
        return row + 1;
    }

    private static int smallRow(Sheet sh, Styles st, int row, String label, BigDecimal amount, long count) {
        Row r = rowAt(sh, row);
        cell(r, 3, label, st.text);
        Cell m = r.createCell(4);
        m.setCellValue(amount.doubleValue());
        m.setCellStyle(st.money);
        Cell n = r.createCell(5);
        n.setCellValue(count);
        n.setCellStyle(st.integer);
        return row + 1;
    }

    private static Row rowAt(Sheet sh, int index) {
        Row r = sh.getRow(index);
        return r != null ? r : sh.createRow(index);
    }

    private static void cell(Sheet sh, int row, int col, String value, CellStyle style) {
        cell(rowAt(sh, row), col, value, style);
    }

    private static void cell(Row r, int col, String value, CellStyle style) {
        Cell c = r.createCell(col);
        if (value != null) c.setCellValue(value);
        c.setCellStyle(style);
    }

    private static void number(Row r, int col, long value, CellStyle style) {
        Cell c = r.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private static void money(Row r, int col, BigDecimal value, Styles st) {
        Cell c = r.createCell(col);
        c.setCellValue(value != null ? value.doubleValue() : 0);
        c.setCellStyle(st.money);
    }

    private static void formula(Row r, int col, String formula, CellStyle style) {
        Cell c = r.createCell(col);
        c.setCellFormula(formula);
        c.setCellStyle(style);
    }

    private static void date(Row r, int col, LocalDateTime value, CellStyle style) {
        Cell c = r.createCell(col);
        if (value != null) c.setCellValue(value);
        c.setCellStyle(style);
    }

    private BigDecimal debtOf(UUID customerId) {
        BigDecimal debt = saleRepository.sumDebtByCustomer(customerId);
        return debt != null ? debt.max(BigDecimal.ZERO) : BigDecimal.ZERO;
    }

    private static BigDecimal sum(List<Sale> sales, java.util.function.Function<Sale, BigDecimal> getter) {
        return sales.stream().map(getter).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** "iPhone 15 ×2 · AirPods Pro ×1" : ce que le client a acheté sur la période. */
    private static String productsSummary(List<Sale> sales) {
        Map<String, Integer> quantities = new LinkedHashMap<>();
        for (Sale s : sales) {
            for (SaleLine l : s.getLines()) quantities.merge(productName(l.getProduct()), l.getQuantity(), Integer::sum);
        }
        return quantities.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .map(e -> e.getKey() + " ×" + e.getValue())
                .collect(Collectors.joining(" · "));
    }

    private static String productName(Product p) {
        List<String> details = new ArrayList<>();
        if (p.getCapacity() != null) details.add(p.getCapacity());
        if (p.getColor() != null) details.add(p.getColor());
        return details.isEmpty() ? p.getName() : p.getName() + " (" + String.join(", ", details) + ")";
    }

    private static String methodLabel(PaymentMethod method) {
        return switch (method) {
            case CHECK -> "Chèque";
            case TRANSFER -> "Virement";
            case CARD -> "Carte bancaire";
            default -> "Espèces";
        };
    }

    private static String expenseLabel(String category) {
        return switch (category) {
            case "RENT" -> "Loyer";
            case "TRANSPORT" -> "Transport";
            case "ELECTRICITY" -> "Électricité";
            case "REPAIR" -> "Réparation";
            default -> "Autre";
        };
    }
}
