package smartshop.service;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import smartshop.entity.Customer;
import smartshop.entity.Product;
import smartshop.entity.Quote;
import smartshop.entity.QuoteLine;
import smartshop.entity.Sale;
import smartshop.entity.SaleLine;
import smartshop.entity.ShopSettings;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Documents commerciaux en PDF : facture, bon de livraison, devis (A4) et ticket de caisse (58 ou 80 mm).
 * Les prix des produits sont saisis TTC ; le HT et la TVA sont recalculés par taux.
 */
@Service
public class DocumentPdfService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Color ACCENT = new Color(15, 118, 110);
    private static final Color LIGHT = new Color(240, 244, 248);

    private final ShopSettingsService settingsService;

    public DocumentPdfService(ShopSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    /** Réponse HTTP qui ouvre le PDF dans le lecteur (ou le télécharge sous ce nom). */
    public static ResponseEntity<byte[]> inline(String fileName, byte[] pdf) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ------------------------------------------------------------------ Lignes communes

    // quantityLabel : "3" ou "2 ctn" ; unitPrice : prix d'une unité ou d'un carton ; total : montant exact
    private record Row(String reference, String designation, String quantityLabel, BigDecimal unitPrice, BigDecimal total, BigDecimal vatRate) {
        Row(String reference, String designation, int quantity, BigDecimal unitPrice, BigDecimal vatRate) {
            this(reference, designation, Integer.toString(quantity), unitPrice, unitPrice.multiply(BigDecimal.valueOf(quantity)), vatRate);
        }
    }

    private BigDecimal vatOf(Product p, ShopSettings settings) {
        return p.getVatRate() != null ? p.getVatRate() : settings.getDefaultVatRate();
    }

    private List<Row> rows(Sale sale, ShopSettings settings) {
        List<Row> rows = new ArrayList<>();
        for (SaleLine l : sale.getLines()) {
            if (l.getPackCount() != null) {
                rows.add(new Row(l.getProduct().getReference(),
                        designation(l.getProduct()) + " - carton de " + l.getProduct().getUnitsPerPack(),
                        l.getPackCount() + " ctn", l.getPackPrice(), l.getLineTotal(), vatOf(l.getProduct(), settings)));
            } else {
                rows.add(new Row(l.getProduct().getReference(), designation(l.getProduct()), l.getQuantity(), l.getUnitPrice(), vatOf(l.getProduct(), settings)));
            }
        }
        return rows;
    }

    private List<Row> rows(Quote quote, ShopSettings settings) {
        List<Row> rows = new ArrayList<>();
        for (QuoteLine l : quote.getLines()) {
            rows.add(new Row(l.getProduct().getReference(), designation(l.getProduct()), l.getQuantity(), l.getUnitPrice(), vatOf(l.getProduct(), settings)));
        }
        return rows;
    }

    private String designation(Product p) {
        StringBuilder text = new StringBuilder(p.getName());
        List<String> details = new ArrayList<>();
        if (p.getColor() != null) details.add(p.getColor());
        if (p.getCapacity() != null) details.add(p.getCapacity());
        if (!details.isEmpty()) text.append(" (").append(String.join(", ", details)).append(')');
        return text.toString();
    }

    // ------------------------------------------------------------------ Documents A4

    public byte[] invoice(Sale sale) {
        ShopSettings settings = settingsService.get();
        String date = DATE.format(sale.getInvoiceDate() != null ? sale.getInvoiceDate() : sale.getSaleDate());
        return a4(settings, "FACTURE", sale.getInvoiceNumber(), date,
                "Vente " + sale.getDisplayNumber(), "Client", sale.getCustomer(), null,
                rows(sale, settings), sale.getDiscount(), sale.getTotal(), true,
                sale.getAmountPaid(), "Arrêtée la présente facture à la somme de : ");
    }

    public byte[] quote(Quote quote) {
        ShopSettings settings = settingsService.get();
        return a4(settings, "DEVIS", quote.getNumber(), DATE.format(quote.getCreatedAt()),
                "Valable jusqu'au " + DATE.format(quote.getValidUntil()), "Client", quote.getCustomer(), quote.getCustomerName(),
                rows(quote, settings), quote.getDiscount(), quote.getTotal(), true,
                null, "Arrêté le présent devis à la somme de : ");
    }

    public byte[] deliveryNote(Sale sale) {
        ShopSettings settings = settingsService.get();
        return a4(settings, "BON DE LIVRAISON", sale.getDeliveryNumber(), DATE.format(LocalDateTime.now()),
                "Vente " + sale.getDisplayNumber(), "Client", sale.getCustomer(), null,
                rows(sale, settings), sale.getDiscount(), sale.getTotal(), false, null, null);
    }

    public byte[] purchaseOrder(smartshop.entity.PurchaseOrder order) {
        ShopSettings settings = settingsService.get();
        List<Row> rows = new ArrayList<>();
        for (smartshop.entity.PurchaseOrderLine l : order.getLines()) {
            rows.add(new Row(l.getProduct().getReference(), designation(l.getProduct()), l.getQuantity(), l.getUnitPrice(), vatOf(l.getProduct(), settings)));
        }
        String subtitle = order.getExpectedDate() != null ? "Livraison souhaitée le " + DATE.format(order.getExpectedDate()) : null;
        String supplier = order.getSupplier().getName() + (order.getSupplier().getPhone() != null ? " - Tél : " + order.getSupplier().getPhone() : "");
        return a4(settings, "BON DE COMMANDE", order.getNumber(), DATE.format(order.getCreatedAt()), subtitle,
                "Fournisseur", null, supplier, rows, BigDecimal.ZERO, order.getTotal(), true, null, null);
    }

    private byte[] a4(ShopSettings settings, String title, String number, String date, String subtitle,
                      String partyLabel, Customer customer, String freeCustomerName, List<Row> rows,
                      BigDecimal discount, BigDecimal total, boolean withPrices,
                      BigDecimal amountPaid, String wordsPrefix) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 40, 50);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font small = font(8, Font.NORMAL, Color.DARK_GRAY);
        Font normal = font(10, Font.NORMAL, Color.BLACK);
        Font bold = font(10, Font.BOLD, Color.BLACK);

        // En-tête : boutique à gauche, document à droite
        PdfPTable header = new PdfPTable(new float[]{3, 2});
        header.setWidthPercentage(100);
        PdfPCell shop = borderless();
        shop.addElement(new Paragraph(orDefault(settings.getShopName(), "SmartShop"), font(16, Font.BOLD, ACCENT)));
        for (String line : shopLines(settings)) shop.addElement(new Paragraph(line, small));
        header.addCell(shop);

        PdfPCell docCell = borderless();
        Paragraph docTitle = new Paragraph(title, font(18, Font.BOLD, ACCENT));
        docTitle.setAlignment(Element.ALIGN_RIGHT);
        docCell.addElement(docTitle);
        docCell.addElement(right("N° " + orDefault(number, "-"), bold));
        docCell.addElement(right("Date : " + date, normal));
        if (subtitle != null) docCell.addElement(right(subtitle, small));
        header.addCell(docCell);
        doc.add(header);

        // Bloc client
        PdfPTable client = new PdfPTable(1);
        client.setWidthPercentage(45);
        client.setHorizontalAlignment(Element.ALIGN_RIGHT);
        client.setSpacingBefore(18);
        PdfPCell clientCell = new PdfPCell();
        clientCell.setPadding(8);
        clientCell.setBorderColor(Color.LIGHT_GRAY);
        clientCell.addElement(new Paragraph(partyLabel, small));
        if (customer != null) {
            clientCell.addElement(new Paragraph(customer.getName(), bold));
            if (customer.getAddress() != null) clientCell.addElement(new Paragraph(customer.getAddress(), normal));
            if (customer.getPhone() != null) clientCell.addElement(new Paragraph("Tél : " + customer.getPhone(), normal));
            if (customer.getIce() != null) clientCell.addElement(new Paragraph("ICE : " + customer.getIce(), normal));
        } else {
            clientCell.addElement(new Paragraph(orDefault(freeCustomerName, "Client de passage"), bold));
        }
        client.addCell(clientCell);
        doc.add(client);

        // Tableau des articles
        PdfPTable table = withPrices
                ? new PdfPTable(new float[]{1.4f, 4.2f, 0.8f, 1.5f, 0.9f, 1.6f})
                : new PdfPTable(new float[]{1.6f, 6f, 1.2f});
        table.setWidthPercentage(100);
        table.setSpacingBefore(18);
        table.setHeaderRows(1);
        List<String> headings = withPrices
                ? List.of("Réf.", "Désignation", "Qté", "P.U. HT", "TVA", "Total TTC")
                : List.of("Réf.", "Désignation", "Quantité");
        for (String h : headings) table.addCell(headCell(h));
        for (Row r : rows) {
            table.addCell(bodyCell(r.reference(), Element.ALIGN_LEFT));
            table.addCell(bodyCell(r.designation(), Element.ALIGN_LEFT));
            table.addCell(bodyCell(r.quantityLabel(), Element.ALIGN_CENTER));
            if (withPrices) {
                table.addCell(bodyCell(money(ht(r.unitPrice(), r.vatRate())), Element.ALIGN_RIGHT));
                table.addCell(bodyCell(percent(r.vatRate()), Element.ALIGN_CENTER));
                table.addCell(bodyCell(money(r.total()), Element.ALIGN_RIGHT));
            }
        }
        doc.add(table);

        if (withPrices) {
            doc.add(totalsTable(rows, discount, total, amountPaid));
            if (wordsPrefix != null) {
                Paragraph words = new Paragraph();
                words.setSpacingBefore(14);
                words.add(new Chunk(wordsPrefix, normal));
                words.add(new Chunk(capitalize(FrenchAmountWords.dirhams(total)) + " TTC.", bold));
                doc.add(words);
            }
        } else {
            // Bon de livraison : signatures
            PdfPTable signatures = new PdfPTable(2);
            signatures.setWidthPercentage(100);
            signatures.setSpacingBefore(40);
            for (String who : List.of("Signature du livreur", "Signature et cachet du client")) {
                PdfPCell cell = new PdfPCell(new Phrase(who, small));
                cell.setFixedHeight(80);
                cell.setBorderColor(Color.LIGHT_GRAY);
                cell.setPadding(6);
                signatures.addCell(cell);
            }
            doc.add(signatures);
        }

        if (settings.getDocumentFooter() != null) {
            Paragraph footer = new Paragraph(settings.getDocumentFooter(), small);
            footer.setSpacingBefore(24);
            footer.setAlignment(Element.ALIGN_CENTER);
            doc.add(footer);
        }
        doc.close();
        return out.toByteArray();
    }

    private PdfPTable totalsTable(List<Row> rows, BigDecimal discount, BigDecimal total, BigDecimal amountPaid) {
        // La remise s'applique au TTC : on la répartit sur chaque taux au prorata
        BigDecimal subtotal = rows.stream().map(Row::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal factor = subtotal.signum() == 0 ? BigDecimal.ONE : total.divide(subtotal, 10, RoundingMode.HALF_UP);
        Map<BigDecimal, BigDecimal> ttcByRate = new TreeMap<>();
        for (Row r : rows) ttcByRate.merge(r.vatRate().stripTrailingZeros(), r.total().multiply(factor), BigDecimal::add);

        BigDecimal totalHt = BigDecimal.ZERO;
        Map<BigDecimal, BigDecimal> vatByRate = new TreeMap<>();
        for (Map.Entry<BigDecimal, BigDecimal> e : ttcByRate.entrySet()) {
            BigDecimal ht = ht(e.getValue(), e.getKey());
            totalHt = totalHt.add(ht);
            vatByRate.put(e.getKey(), e.getValue().setScale(2, RoundingMode.HALF_UP).subtract(ht));
        }

        PdfPTable totals = new PdfPTable(new float[]{2, 1.4f});
        totals.setWidthPercentage(42);
        totals.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totals.setSpacingBefore(10);
        if (discount != null && discount.signum() > 0) {
            totalLine(totals, "Total avant remise", money(subtotal), false);
            totalLine(totals, "Remise", "- " + money(discount), false);
        }
        totalLine(totals, "Total HT", money(totalHt), false);
        vatByRate.forEach((rate, vat) -> totalLine(totals, "TVA " + percent(rate), money(vat), false));
        totalLine(totals, "Total TTC", money(total), true);
        if (amountPaid != null) {
            totalLine(totals, "Payé", money(amountPaid), false);
            BigDecimal rest = total.subtract(amountPaid);
            if (rest.signum() > 0) totalLine(totals, "Reste à payer", money(rest), true);
        }
        return totals;
    }

    // ------------------------------------------------------------------ Relevé de compte client

    public byte[] statement(smartshop.dto.StatementResponse st) {
        ShopSettings settings = settingsService.get();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 40, 50);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font small = font(8, Font.NORMAL, Color.DARK_GRAY);
        Font normal = font(10, Font.NORMAL, Color.BLACK);
        Font bold = font(10, Font.BOLD, Color.BLACK);

        PdfPTable header = new PdfPTable(new float[]{3, 2});
        header.setWidthPercentage(100);
        PdfPCell shop = borderless();
        shop.addElement(new Paragraph(orDefault(settings.getShopName(), "SmartShop"), font(16, Font.BOLD, ACCENT)));
        for (String line : shopLines(settings)) shop.addElement(new Paragraph(line, small));
        header.addCell(shop);
        PdfPCell title = borderless();
        Paragraph t = new Paragraph("RELEVÉ DE COMPTE", font(16, Font.BOLD, ACCENT));
        t.setAlignment(Element.ALIGN_RIGHT);
        title.addElement(t);
        String period = (st.from() != null ? "Du " + DATE.format(st.from()) + " " : "") + "au " + DATE.format(st.to());
        title.addElement(right(period, normal));
        title.addElement(right("Édité le " + DATE.format(LocalDateTime.now()), small));
        header.addCell(title);
        doc.add(header);

        Paragraph client = new Paragraph();
        client.setSpacingBefore(14);
        client.add(new Chunk("Client : ", normal));
        client.add(new Chunk(st.customerName(), bold));
        if (st.customerPhone() != null) client.add(new Chunk("  -  Tél : " + st.customerPhone(), normal));
        if (st.customerIce() != null) client.add(new Chunk("  -  ICE : " + st.customerIce(), normal));
        doc.add(client);

        PdfPTable table = new PdfPTable(new float[]{1.3f, 1.6f, 3.2f, 1.4f, 1.4f, 1.5f});
        table.setWidthPercentage(100);
        table.setSpacingBefore(12);
        table.setHeaderRows(1);
        for (String h : List.of("Date", "Réf.", "Libellé", "Débit", "Crédit", "Solde")) table.addCell(headCell(h));
        table.addCell(bodyCell("", Element.ALIGN_LEFT));
        table.addCell(bodyCell("", Element.ALIGN_LEFT));
        table.addCell(bodyCell("Solde au début de la période", Element.ALIGN_LEFT));
        table.addCell(bodyCell("", Element.ALIGN_RIGHT));
        table.addCell(bodyCell("", Element.ALIGN_RIGHT));
        table.addCell(bodyCell(money(st.openingBalance()), Element.ALIGN_RIGHT));
        for (smartshop.dto.StatementResponse.Entry e : st.entries()) {
            table.addCell(bodyCell(DATE.format(e.date()), Element.ALIGN_LEFT));
            table.addCell(bodyCell(e.reference(), Element.ALIGN_LEFT));
            table.addCell(bodyCell(e.label(), Element.ALIGN_LEFT));
            table.addCell(bodyCell(e.debit().signum() > 0 ? money(e.debit()) : "", Element.ALIGN_RIGHT));
            table.addCell(bodyCell(e.credit().signum() > 0 ? money(e.credit()) : "", Element.ALIGN_RIGHT));
            table.addCell(bodyCell(money(e.balance()), Element.ALIGN_RIGHT));
        }
        doc.add(table);

        PdfPTable totals = new PdfPTable(new float[]{2, 1.4f});
        totals.setWidthPercentage(42);
        totals.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totals.setSpacingBefore(10);
        totalLine(totals, "Total débit", money(st.totalDebit()), false);
        totalLine(totals, "Total crédit", money(st.totalCredit()), false);
        totalLine(totals, "Solde dû", money(st.closingBalance()), true);
        doc.add(totals);
        doc.close();
        return out.toByteArray();
    }

    // ------------------------------------------------------------------ Ticket de caisse

    /** Ticket pour imprimante thermique : largeur 58 ou 80 mm, hauteur adaptée au contenu. */
    public byte[] ticket(Sale sale, int widthMm) {
        ShopSettings settings = settingsService.get();
        float width = mmToPt(widthMm == 58 ? 58 : 80);
        float margin = mmToPt(3);
        float fontSize = widthMm == 58 ? 7 : 8.5f;
        float height = 230 + sale.getLines().size() * (fontSize * 3.2f) + (settings.getTicketFooter() != null ? 30 : 0);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(new Rectangle(width, height), margin, margin, margin, margin);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font normal = font(fontSize, Font.NORMAL, Color.BLACK);
        Font bold = font(fontSize, Font.BOLD, Color.BLACK);
        Font big = font(fontSize + 3, Font.BOLD, Color.BLACK);

        doc.add(center(orDefault(settings.getShopName(), "SmartShop"), big));
        for (String line : shopLines(settings)) doc.add(center(line, normal));
        doc.add(center("--------------------------------", normal));
        doc.add(center("Ticket " + sale.getDisplayNumber(), bold));
        doc.add(center(DATE_TIME.format(sale.getSaleDate()), normal));
        if (sale.getCustomer() != null) doc.add(center("Client : " + sale.getCustomer().getName(), normal));
        doc.add(center("--------------------------------", normal));

        PdfPTable table = new PdfPTable(new float[]{3.2f, 1.6f});
        table.setWidthPercentage(100);
        for (Row r : rows(sale, settings)) {
            PdfPCell name = plain(new Phrase(r.designation(), normal), Element.ALIGN_LEFT);
            name.setColspan(2);
            table.addCell(name);
            table.addCell(plain(new Phrase("  " + r.quantityLabel() + " x " + money(r.unitPrice()), normal), Element.ALIGN_LEFT));
            table.addCell(plain(new Phrase(money(r.total()), normal), Element.ALIGN_RIGHT));
        }
        if (sale.getDiscount().signum() > 0) {
            table.addCell(plain(new Phrase("Remise", normal), Element.ALIGN_LEFT));
            table.addCell(plain(new Phrase("-" + money(sale.getDiscount()), normal), Element.ALIGN_RIGHT));
        }
        // L'unité est dans le libellé : sur 58 mm, "10 089,00 DH" ne tient pas sur une ligne
        table.addCell(plain(new Phrase("TOTAL DH", big), Element.ALIGN_LEFT));
        table.addCell(plain(new Phrase(money(sale.getTotal()), big), Element.ALIGN_RIGHT));
        table.addCell(plain(new Phrase("Payé", normal), Element.ALIGN_LEFT));
        table.addCell(plain(new Phrase(money(sale.getAmountPaid()), normal), Element.ALIGN_RIGHT));
        if (sale.getRemaining().signum() > 0) {
            table.addCell(plain(new Phrase("Reste (crédit)", bold), Element.ALIGN_LEFT));
            table.addCell(plain(new Phrase(money(sale.getRemaining()), bold), Element.ALIGN_RIGHT));
        }
        doc.add(table);

        doc.add(center("--------------------------------", normal));
        doc.add(center(orDefault(settings.getTicketFooter(), "Merci de votre visite !"), normal));
        doc.close();
        return out.toByteArray();
    }

    // ------------------------------------------------------------------ Utilitaires

    private List<String> shopLines(ShopSettings s) {
        List<String> lines = new ArrayList<>();
        String address = String.join(", ", nonNull(s.getAddress(), s.getCity()));
        if (!address.isEmpty()) lines.add(address);
        List<String> contact = nonNull(s.getPhone() != null ? "Tél : " + s.getPhone() : null, s.getEmail());
        if (!contact.isEmpty()) lines.add(String.join(" - ", contact));
        List<String> legal = nonNull(
                s.getIce() != null ? "ICE : " + s.getIce() : null,
                s.getFiscalId() != null ? "IF : " + s.getFiscalId() : null,
                s.getTradeRegister() != null ? "RC : " + s.getTradeRegister() : null,
                s.getPatente() != null ? "Patente : " + s.getPatente() : null);
        if (!legal.isEmpty()) lines.add(String.join(" - ", legal));
        return lines;
    }

    private static List<String> nonNull(String... values) {
        List<String> list = new ArrayList<>();
        for (String v : values) if (v != null && !v.isBlank()) list.add(v);
        return list;
    }

    private static BigDecimal ht(BigDecimal ttc, BigDecimal vatRate) {
        BigDecimal divisor = BigDecimal.ONE.add(vatRate.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
        return ttc.divide(divisor, 2, RoundingMode.HALF_UP);
    }

    static String money(BigDecimal value) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.FRANCE);
        symbols.setGroupingSeparator(' ');
        symbols.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.00", symbols).format(value.setScale(2, RoundingMode.HALF_UP));
    }

    private static String percent(BigDecimal rate) {
        return rate.stripTrailingZeros().toPlainString() + " %";
    }

    private static String orDefault(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    private static String capitalize(String text) {
        return text.isEmpty() ? text : Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    private static float mmToPt(float mm) {
        return mm * 72f / 25.4f;
    }

    private static Font font(float size, int style, Color color) {
        return FontFactory.getFont(FontFactory.HELVETICA, "Cp1252", false, size, style, color);
    }

    private static PdfPCell borderless() {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.NO_BORDER);
        return cell;
    }

    private static PdfPCell plain(Phrase phrase, int align) {
        PdfPCell cell = new PdfPCell(phrase);
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setHorizontalAlignment(align);
        cell.setPaddingLeft(0);
        cell.setPaddingRight(0);
        cell.setPaddingTop(1);
        cell.setPaddingBottom(1);
        return cell;
    }

    private static PdfPCell headCell(String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font(9, Font.BOLD, Color.WHITE)));
        cell.setBackgroundColor(ACCENT);
        cell.setBorderColor(ACCENT);
        cell.setPadding(6);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        return cell;
    }

    private static PdfPCell bodyCell(String text, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font(9, Font.NORMAL, Color.BLACK)));
        cell.setBorderColor(Color.LIGHT_GRAY);
        cell.setPadding(5);
        cell.setHorizontalAlignment(align);
        return cell;
    }

    private static void totalLine(PdfPTable table, String label, String value, boolean strong) {
        Font f = font(strong ? 11 : 9.5f, strong ? Font.BOLD : Font.NORMAL, Color.BLACK);
        PdfPCell l = new PdfPCell(new Phrase(label, f));
        PdfPCell v = new PdfPCell(new Phrase(value + " DH", f));
        for (PdfPCell c : List.of(l, v)) {
            c.setPadding(5);
            c.setBorderColor(Color.LIGHT_GRAY);
            if (strong) c.setBackgroundColor(LIGHT);
        }
        v.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(l);
        table.addCell(v);
    }

    private static Paragraph right(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_RIGHT);
        return p;
    }

    private static Paragraph center(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_CENTER);
        return p;
    }
}
