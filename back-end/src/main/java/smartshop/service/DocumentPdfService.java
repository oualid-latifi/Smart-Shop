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
    private static final Color ACCENT = new Color(29, 79, 216);
    private static final Color LIGHT = new Color(243, 246, 252);
    private static final Color ZEBRA = new Color(248, 250, 253);
    private static final Color RULE = new Color(220, 226, 236);
    private static final Color DARK = new Color(17, 24, 39);
    private static final Color GRAY = new Color(100, 116, 139);
    private static final Color SUCCESS = new Color(21, 128, 61);
    private static final Color DANGER = new Color(185, 28, 28);

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

    /** Ligne "libellé : valeur" du cartouche en haut à droite (N°, date, référence…). */
    private record Meta(String label, String value) {
    }

    /** Bloc d'adresse (émetteur, client, fournisseur) : la première ligne est le nom. */
    private record Party(String label, List<String> lines) {
    }

    /** Tout ce qui varie d'un document A4 à l'autre. */
    private record DocSpec(String title, List<Meta> meta, Party left, Party right, List<Row> rows, boolean withPrices,
                           BigDecimal discount, BigDecimal total, BigDecimal amountPaid, String paymentLabel,
                           String wordsPrefix, String note, List<String> signatures) {
    }

    public byte[] invoice(Sale sale) {
        ShopSettings settings = settingsService.get();
        List<Meta> meta = new ArrayList<>();
        meta.add(new Meta("Facture N°", orDefault(sale.getInvoiceNumber(), "-")));
        meta.add(new Meta("Date", DATE.format(sale.getInvoiceDate() != null ? sale.getInvoiceDate() : sale.getSaleDate())));
        meta.add(new Meta("Réf. vente", sale.getDisplayNumber()));
        if (sale.getDeliveryNumber() != null) meta.add(new Meta("Bon de livraison", sale.getDeliveryNumber()));
        if (sale.getSeller() != null) meta.add(new Meta("Vendeur", sale.getSeller().getName()));
        return a4(settings, new DocSpec("FACTURE", meta, issuer(settings), customerParty("FACTURÉ À", sale.getCustomer(), null),
                rows(sale, settings), true, sale.getDiscount(), sale.getTotal(), sale.getAmountPaid(),
                paymentLabel(sale.getPaymentMethod()), "Arrêtée la présente facture à la somme de :", null,
                List.of("Cachet et signature")));
    }

    public byte[] quote(Quote quote) {
        ShopSettings settings = settingsService.get();
        List<Meta> meta = List.of(
                new Meta("Devis N°", quote.getNumber()),
                new Meta("Date", DATE.format(quote.getCreatedAt())),
                new Meta("Valable jusqu'au", DATE.format(quote.getValidUntil())));
        return a4(settings, new DocSpec("DEVIS", meta, issuer(settings), customerParty("CLIENT", quote.getCustomer(), quote.getCustomerName()),
                rows(quote, settings), true, quote.getDiscount(), quote.getTotal(), null, null,
                "Arrêté le présent devis à la somme de :", quote.getNote(),
                List.of("Bon pour accord (date, cachet et signature du client)")));
    }

    public byte[] deliveryNote(Sale sale) {
        ShopSettings settings = settingsService.get();
        List<Meta> meta = new ArrayList<>();
        meta.add(new Meta("BL N°", orDefault(sale.getDeliveryNumber(), "-")));
        meta.add(new Meta("Date", DATE.format(LocalDateTime.now())));
        meta.add(new Meta("Réf. vente", sale.getDisplayNumber()));
        if (sale.getInvoiceNumber() != null) meta.add(new Meta("Facture", sale.getInvoiceNumber()));
        return a4(settings, new DocSpec("BON DE LIVRAISON", meta, issuer(settings), customerParty("LIVRÉ À", sale.getCustomer(), null),
                rows(sale, settings), false, BigDecimal.ZERO, sale.getTotal(), null, null, null,
                "Marchandise reçue en bon état et conforme à la commande.",
                List.of("Signature du livreur", "Signature et cachet du client")));
    }

    public byte[] purchaseOrder(smartshop.entity.PurchaseOrder order) {
        ShopSettings settings = settingsService.get();
        List<Row> rows = new ArrayList<>();
        for (smartshop.entity.PurchaseOrderLine l : order.getLines()) {
            rows.add(new Row(l.getProduct().getReference(), designation(l.getProduct()), l.getQuantity(), l.getUnitPrice(), vatOf(l.getProduct(), settings)));
        }
        List<Meta> meta = new ArrayList<>();
        meta.add(new Meta("Commande N°", order.getNumber()));
        meta.add(new Meta("Date", DATE.format(order.getCreatedAt())));
        if (order.getExpectedDate() != null) meta.add(new Meta("Livraison souhaitée", DATE.format(order.getExpectedDate())));
        List<String> supplier = new ArrayList<>();
        supplier.add(order.getSupplier().getName());
        if (order.getSupplier().getPhone() != null) supplier.add("Tél : " + order.getSupplier().getPhone());
        return a4(settings, new DocSpec("BON DE COMMANDE", meta, new Party("ACHETEUR", issuer(settings).lines()), new Party("FOURNISSEUR", supplier),
                rows, true, BigDecimal.ZERO, order.getTotal(), null, null, null, order.getNote(),
                List.of("Cachet et signature de l'acheteur")));
    }

    private Party issuer(ShopSettings s) {
        List<String> lines = new ArrayList<>();
        lines.add(orDefault(s.getShopName(), "SmartShop"));
        String address = String.join(", ", nonNull(s.getAddress(), s.getCity()));
        if (!address.isEmpty()) lines.add(address);
        if (s.getPhone() != null) lines.add("Tél : " + s.getPhone());
        if (s.getEmail() != null) lines.add(s.getEmail());
        if (s.getIce() != null) lines.add("ICE : " + s.getIce());
        return new Party("ÉMETTEUR", lines);
    }

    private Party customerParty(String label, Customer customer, String freeName) {
        List<String> lines = new ArrayList<>();
        if (customer == null) {
            lines.add(orDefault(freeName, "Client de passage"));
            return new Party(label, lines);
        }
        lines.add(customer.getName());
        if (customer.getAddress() != null) lines.add(customer.getAddress());
        if (customer.getPhone() != null) lines.add("Tél : " + customer.getPhone());
        if (customer.getIce() != null) lines.add("ICE : " + customer.getIce());
        return new Party(label, lines);
    }

    private static String paymentLabel(smartshop.entity.PaymentMethod method) {
        return switch (method) {
            case CHECK -> "Chèque";
            case TRANSFER -> "Virement bancaire";
            case CARD -> "Carte bancaire";
            default -> "Espèces";
        };
    }

    private byte[] a4(ShopSettings settings, DocSpec spec) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 36, 36, 36, 64);
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        writer.setPageEvent(new PageFooter(settings));
        doc.open();

        header(doc, settings, spec.title(), spec.meta());
        parties(doc, spec.left(), spec.right());
        doc.add(itemsTable(spec.rows(), spec.withPrices()));

        if (spec.withPrices()) {
            summary(doc, spec);
        } else if (spec.note() != null) {
            Paragraph note = new Paragraph(spec.note(), font(9, Font.ITALIC, GRAY));
            note.setSpacingBefore(10);
            doc.add(note);
        }
        signatures(doc, spec.signatures());

        if (settings.getDocumentFooter() != null) {
            Paragraph footer = new Paragraph(settings.getDocumentFooter(), font(8.5f, Font.ITALIC, GRAY));
            footer.setSpacingBefore(18);
            footer.setAlignment(Element.ALIGN_CENTER);
            doc.add(footer);
        }
        doc.close();
        return out.toByteArray();
    }

    /** En-tête : logo + boutique à gauche, titre + cartouche de références à droite, filet de couleur. */
    private void header(Document doc, ShopSettings settings, String title, List<Meta> meta) {
        PdfPTable header = new PdfPTable(new float[]{1.3f, 1});
        header.setWidthPercentage(100);

        PdfPTable brand = new PdfPTable(new float[]{0.24f, 1});
        brand.setWidthPercentage(100);
        String shopName = orDefault(settings.getShopName(), "SmartShop");
        PdfPCell logo = new PdfPCell(new Phrase(initials(shopName), font(17, Font.BOLD, Color.WHITE)));
        logo.setBackgroundColor(ACCENT);
        logo.setBorder(Rectangle.NO_BORDER);
        logo.setFixedHeight(48);
        logo.setHorizontalAlignment(Element.ALIGN_CENTER);
        logo.setVerticalAlignment(Element.ALIGN_MIDDLE);
        brand.addCell(logo);
        PdfPCell shop = borderless();
        shop.setPaddingLeft(10);
        shop.addElement(new Paragraph(shopName, font(15, Font.BOLD, DARK)));
        // Une seule ligne ici : le détail des coordonnées est dans le bloc "Émetteur" et en pied de page
        String tagline = String.join(" · ", nonNull(settings.getCity(), settings.getPhone(), settings.getEmail()));
        if (!tagline.isBlank()) shop.addElement(new Paragraph(tagline, font(8.5f, Font.NORMAL, GRAY)));
        brand.addCell(shop);
        PdfPCell left = borderless();
        left.addElement(brand);
        header.addCell(left);

        PdfPCell right = borderless();
        Paragraph docTitle = new Paragraph(title, font(20, Font.BOLD, ACCENT));
        docTitle.setAlignment(Element.ALIGN_RIGHT);
        right.addElement(docTitle);
        PdfPTable metaTable = new PdfPTable(new float[]{1.1f, 1});
        metaTable.setWidthPercentage(100);
        metaTable.setSpacingBefore(6);
        for (Meta m : meta) {
            PdfPCell label = new PdfPCell(new Phrase(m.label(), font(8.5f, Font.NORMAL, GRAY)));
            PdfPCell value = new PdfPCell(new Phrase(m.value(), font(9, Font.BOLD, DARK)));
            for (PdfPCell c : List.of(label, value)) {
                c.setBorder(Rectangle.BOTTOM);
                c.setBorderColor(RULE);
                c.setPaddingTop(3);
                c.setPaddingBottom(4);
            }
            value.setHorizontalAlignment(Element.ALIGN_RIGHT);
            metaTable.addCell(label);
            metaTable.addCell(value);
        }
        right.addElement(metaTable);
        header.addCell(right);
        doc.add(header);

        // Filet de couleur sous l'en-tête
        PdfPTable rule = new PdfPTable(1);
        rule.setWidthPercentage(100);
        rule.setSpacingBefore(10);
        PdfPCell bar = new PdfPCell();
        bar.setFixedHeight(3);
        bar.setBackgroundColor(ACCENT);
        bar.setBorder(Rectangle.NO_BORDER);
        rule.addCell(bar);
        doc.add(rule);
    }

    /** Deux blocs d'adresse côte à côte (émetteur / destinataire). */
    private void parties(Document doc, Party left, Party right) {
        PdfPTable table = new PdfPTable(new float[]{1, 0.06f, 1});
        table.setWidthPercentage(100);
        table.setSpacingBefore(14);
        table.addCell(partyCell(left));
        table.addCell(borderless());
        table.addCell(partyCell(right));
        doc.add(table);
    }

    private PdfPCell partyCell(Party party) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(LIGHT);
        cell.setBorder(Rectangle.LEFT);
        cell.setBorderColorLeft(ACCENT);
        cell.setBorderWidthLeft(3);
        cell.setPadding(10);
        cell.addElement(new Paragraph(party.label(), font(8, Font.BOLD, ACCENT)));
        for (int i = 0; i < party.lines().size(); i++) {
            Paragraph p = new Paragraph(party.lines().get(i), i == 0 ? font(11, Font.BOLD, DARK) : font(9, Font.NORMAL, DARK));
            p.setLeading(i == 0 ? 15 : 12);
            cell.addElement(p);
        }
        return cell;
    }

    /** Tableau des articles : en-tête coloré, lignes alternées, montants alignés à droite. */
    private PdfPTable itemsTable(List<Row> rows, boolean withPrices) {
        PdfPTable table = withPrices
                ? new PdfPTable(new float[]{0.4f, 1.3f, 3.6f, 0.8f, 1.3f, 0.7f, 1.4f})
                : new PdfPTable(new float[]{0.4f, 1.4f, 4.6f, 1, 1});
        table.setWidthPercentage(100);
        table.setSpacingBefore(16);
        table.setHeaderRows(1);
        List<String> headings = withPrices
                ? List.of("#", "Réf.", "Désignation", "Qté", "P.U. HT", "TVA", "Total HT")
                : List.of("#", "Réf.", "Désignation", "Quantité", "Contrôle");
        for (int i = 0; i < headings.size(); i++) {
            table.addCell(headCell(headings.get(i), i >= 3 ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT));
        }
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            Color bg = i % 2 == 1 ? ZEBRA : Color.WHITE;
            table.addCell(itemCell(Integer.toString(i + 1), Element.ALIGN_LEFT, bg, GRAY));
            table.addCell(itemCell(r.reference(), Element.ALIGN_LEFT, bg, GRAY));
            table.addCell(itemCell(r.designation(), Element.ALIGN_LEFT, bg, DARK));
            table.addCell(itemCell(r.quantityLabel(), Element.ALIGN_RIGHT, bg, DARK));
            if (withPrices) {
                table.addCell(itemCell(money(ht(r.unitPrice(), r.vatRate())), Element.ALIGN_RIGHT, bg, DARK));
                table.addCell(itemCell(percent(r.vatRate()), Element.ALIGN_RIGHT, bg, GRAY));
                table.addCell(itemCell(money(ht(r.total(), r.vatRate())), Element.ALIGN_RIGHT, bg, DARK));
            } else {
                table.addCell(itemCell("", Element.ALIGN_RIGHT, bg, DARK));
            }
        }
        return table;
    }

    /** Bas de document : montant en lettres et paiement à gauche, totaux à droite. */
    private void summary(Document doc, DocSpec spec) {
        PdfPTable layout = new PdfPTable(new float[]{1.15f, 0.08f, 1});
        layout.setWidthPercentage(100);
        layout.setSpacingBefore(14);
        layout.setKeepTogether(true);

        PdfPCell left = borderless();
        if (spec.wordsPrefix() != null) {
            PdfPCell words = new PdfPCell();
            words.setBorderColor(RULE);
            words.setPadding(9);
            words.addElement(new Paragraph(spec.wordsPrefix(), font(8.5f, Font.NORMAL, GRAY)));
            words.addElement(new Paragraph(capitalize(FrenchAmountWords.dirhams(spec.total())) + " TTC.", font(9.5f, Font.BOLD, DARK)));
            PdfPTable box = new PdfPTable(1);
            box.setWidthPercentage(100);
            box.addCell(words);
            left.addElement(box);
        }
        if (spec.paymentLabel() != null || spec.amountPaid() != null) {
            PdfPTable pay = new PdfPTable(new float[]{1, 1});
            pay.setWidthPercentage(100);
            pay.setSpacingBefore(8);
            if (spec.paymentLabel() != null) payRow(pay, "Mode de paiement", spec.paymentLabel(), DARK);
            if (spec.amountPaid() != null) {
                payRow(pay, "Montant réglé", money(spec.amountPaid()) + " DH", SUCCESS);
                BigDecimal rest = spec.total().subtract(spec.amountPaid());
                payRow(pay, "Reste à payer", money(rest.max(BigDecimal.ZERO)) + " DH", rest.signum() > 0 ? DANGER : DARK);
            }
            left.addElement(pay);
        }
        if (spec.note() != null && !spec.note().isBlank()) {
            Paragraph note = new Paragraph("Note : " + spec.note(), font(8.5f, Font.ITALIC, GRAY));
            note.setSpacingBefore(8);
            left.addElement(note);
        }
        layout.addCell(left);
        layout.addCell(borderless());

        PdfPCell right = borderless();
        right.addElement(totalsTable(spec.rows(), spec.discount(), spec.total()));
        layout.addCell(right);
        doc.add(layout);
    }

    private PdfPTable totalsTable(List<Row> rows, BigDecimal discount, BigDecimal total) {
        // Prix saisis TTC : la remise est répartie au prorata sur chaque taux de TVA
        BigDecimal subtotal = rows.stream().map(Row::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal factor = subtotal.signum() == 0 ? BigDecimal.ONE : total.divide(subtotal, 10, RoundingMode.HALF_UP);
        BigDecimal grossHt = BigDecimal.ZERO;
        Map<BigDecimal, BigDecimal> ttcByRate = new TreeMap<>();
        for (Row r : rows) {
            grossHt = grossHt.add(ht(r.total(), r.vatRate()));
            ttcByRate.merge(r.vatRate().stripTrailingZeros(), r.total().multiply(factor), BigDecimal::add);
        }
        BigDecimal netHt = BigDecimal.ZERO;
        Map<BigDecimal, BigDecimal> vatByRate = new TreeMap<>();
        for (Map.Entry<BigDecimal, BigDecimal> e : ttcByRate.entrySet()) {
            BigDecimal ht = ht(e.getValue(), e.getKey());
            netHt = netHt.add(ht);
            vatByRate.put(e.getKey(), e.getValue().setScale(2, RoundingMode.HALF_UP).subtract(ht));
        }

        PdfPTable totals = new PdfPTable(new float[]{1.4f, 1});
        totals.setWidthPercentage(100);
        if (discount != null && discount.signum() > 0) {
            totalLine(totals, "Total HT brut", money(grossHt), false);
            totalLine(totals, "Remise", "- " + money(grossHt.subtract(netHt)), false);
            totalLine(totals, "Total HT net", money(netHt), false);
        } else {
            totalLine(totals, "Total HT", money(netHt), false);
        }
        vatByRate.forEach((rate, vat) -> totalLine(totals, "TVA " + percent(rate), money(vat), false));
        totalLine(totals, "TOTAL TTC", money(total), true);
        return totals;
    }

    private static void payRow(PdfPTable table, String label, String value, Color valueColor) {
        PdfPCell l = new PdfPCell(new Phrase(label, font(8.5f, Font.NORMAL, GRAY)));
        PdfPCell v = new PdfPCell(new Phrase(value, font(9, Font.BOLD, valueColor)));
        for (PdfPCell c : List.of(l, v)) {
            c.setBorder(Rectangle.BOTTOM);
            c.setBorderColor(RULE);
            c.setPaddingTop(3);
            c.setPaddingBottom(4);
        }
        v.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(l);
        table.addCell(v);
    }

    /** Cases de signature alignées à droite (une ou deux). */
    private void signatures(Document doc, List<String> labels) {
        if (labels == null || labels.isEmpty()) return;
        PdfPTable table = labels.size() == 1 ? new PdfPTable(new float[]{1.3f, 1}) : new PdfPTable(new float[]{1, 0.08f, 1});
        table.setWidthPercentage(100);
        table.setSpacingBefore(22);
        table.setKeepTogether(true);
        if (labels.size() == 1) table.addCell(borderless());
        for (int i = 0; i < labels.size(); i++) {
            if (i > 0) table.addCell(borderless());
            PdfPCell box = new PdfPCell(new Phrase(labels.get(i), font(8.5f, Font.NORMAL, GRAY)));
            box.setFixedHeight(78);
            box.setBorderColor(RULE);
            box.setPadding(7);
            table.addCell(box);
        }
        doc.add(table);
    }

    /** Pied de chaque page : mentions légales et numéro de page "x / y". */
    private final class PageFooter extends com.lowagie.text.pdf.PdfPageEventHelper {
        private final ShopSettings settings;
        private com.lowagie.text.pdf.PdfTemplate totalPages;
        private com.lowagie.text.pdf.BaseFont base;

        PageFooter(ShopSettings settings) {
            this.settings = settings;
        }

        @Override
        public void onOpenDocument(PdfWriter writer, Document document) {
            totalPages = writer.getDirectContent().createTemplate(30, 12);
            try {
                base = com.lowagie.text.pdf.BaseFont.createFont(com.lowagie.text.pdf.BaseFont.HELVETICA, "Cp1252", false);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            com.lowagie.text.pdf.PdfContentByte cb = writer.getDirectContent();
            float left = document.left();
            float right = document.right();
            float y = 44;
            cb.saveState();
            cb.setColorStroke(RULE);
            cb.setLineWidth(0.6f);
            cb.moveTo(left, y);
            cb.lineTo(right, y);
            cb.stroke();

            List<String> legal = nonNull(orDefault(settings.getShopName(), "SmartShop"),
                    settings.getIce() != null ? "ICE " + settings.getIce() : null,
                    settings.getFiscalId() != null ? "IF " + settings.getFiscalId() : null,
                    settings.getTradeRegister() != null ? "RC " + settings.getTradeRegister() : null,
                    settings.getPatente() != null ? "Patente " + settings.getPatente() : null);
            String contact = String.join(" · ", nonNull(String.join(", ", nonNull(settings.getAddress(), settings.getCity())),
                    settings.getPhone() != null ? "Tél " + settings.getPhone() : null, settings.getEmail()));

            cb.beginText();
            cb.setFontAndSize(base, 7.5f);
            cb.setColorFill(GRAY);
            cb.showTextAligned(Element.ALIGN_LEFT, String.join(" · ", legal), left, y - 12, 0);
            if (!contact.isBlank()) cb.showTextAligned(Element.ALIGN_LEFT, contact, left, y - 22, 0);
            String page = "Page " + writer.getPageNumber() + " / ";
            cb.showTextAligned(Element.ALIGN_RIGHT, page, right - 14, y - 12, 0);
            cb.endText();
            cb.addTemplate(totalPages, right - 14, y - 12);
            cb.restoreState();
        }

        @Override
        public void onCloseDocument(PdfWriter writer, Document document) {
            totalPages.beginText();
            totalPages.setFontAndSize(base, 7.5f);
            totalPages.setColorFill(GRAY);
            totalPages.showText(String.valueOf(writer.getPageNumber() - 1));
            totalPages.endText();
        }
    }

    // ------------------------------------------------------------------ Relevé de compte client

    public byte[] statement(smartshop.dto.StatementResponse st) {
        ShopSettings settings = settingsService.get();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 36, 36, 36, 64);
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        writer.setPageEvent(new PageFooter(settings));
        doc.open();

        String period = (st.from() != null ? DATE.format(st.from()) + " - " : "Jusqu'au ") + DATE.format(st.to());
        header(doc, settings, "RELEVÉ DE COMPTE", List.of(new Meta("Période", period), new Meta("Édité le", DATE.format(LocalDateTime.now()))));
        List<String> client = new ArrayList<>();
        client.add(st.customerName());
        if (st.customerAddress() != null) client.add(st.customerAddress());
        if (st.customerPhone() != null) client.add("Tél : " + st.customerPhone());
        if (st.customerIce() != null) client.add("ICE : " + st.customerIce());
        parties(doc, issuer(settings), new Party("CLIENT", client));

        PdfPTable table = new PdfPTable(new float[]{1.2f, 1.5f, 3.2f, 1.3f, 1.3f, 1.4f});
        table.setWidthPercentage(100);
        table.setSpacingBefore(16);
        table.setHeaderRows(1);
        List<String> headings = List.of("Date", "Réf.", "Libellé", "Débit", "Crédit", "Solde");
        for (int i = 0; i < headings.size(); i++) table.addCell(headCell(headings.get(i), i >= 3 ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT));
        table.addCell(itemCell("", Element.ALIGN_LEFT, LIGHT, GRAY));
        table.addCell(itemCell("", Element.ALIGN_LEFT, LIGHT, GRAY));
        table.addCell(itemCell("Solde au début de la période", Element.ALIGN_LEFT, LIGHT, DARK));
        table.addCell(itemCell("", Element.ALIGN_RIGHT, LIGHT, DARK));
        table.addCell(itemCell("", Element.ALIGN_RIGHT, LIGHT, DARK));
        table.addCell(itemCell(money(st.openingBalance()), Element.ALIGN_RIGHT, LIGHT, DARK));
        for (int i = 0; i < st.entries().size(); i++) {
            smartshop.dto.StatementResponse.Entry e = st.entries().get(i);
            Color bg = i % 2 == 1 ? ZEBRA : Color.WHITE;
            table.addCell(itemCell(DATE.format(e.date()), Element.ALIGN_LEFT, bg, GRAY));
            table.addCell(itemCell(e.reference(), Element.ALIGN_LEFT, bg, GRAY));
            table.addCell(itemCell(e.label(), Element.ALIGN_LEFT, bg, DARK));
            table.addCell(itemCell(e.debit().signum() > 0 ? money(e.debit()) : "", Element.ALIGN_RIGHT, bg, DARK));
            table.addCell(itemCell(e.credit().signum() > 0 ? money(e.credit()) : "", Element.ALIGN_RIGHT, bg, SUCCESS));
            table.addCell(itemCell(money(e.balance()), Element.ALIGN_RIGHT, bg, DARK));
        }
        doc.add(table);

        PdfPTable layout = new PdfPTable(new float[]{1.15f, 0.08f, 1});
        layout.setWidthPercentage(100);
        layout.setSpacingBefore(14);
        layout.setKeepTogether(true);
        layout.addCell(borderless());
        layout.addCell(borderless());
        PdfPTable totals = new PdfPTable(new float[]{1.4f, 1});
        totals.setWidthPercentage(100);
        totalLine(totals, "Total débit", money(st.totalDebit()), false);
        totalLine(totals, "Total crédit", money(st.totalCredit()), false);
        totalLine(totals, "SOLDE DÛ", money(st.closingBalance()), true);
        PdfPCell right = borderless();
        right.addElement(totals);
        layout.addCell(right);
        doc.add(layout);
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

    private static PdfPCell headCell(String text, int align) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font(8.5f, Font.BOLD, Color.WHITE)));
        cell.setBackgroundColor(ACCENT);
        cell.setBorder(Rectangle.NO_BORDER);
        cell.setPaddingTop(7);
        cell.setPaddingBottom(7);
        cell.setPaddingLeft(6);
        cell.setPaddingRight(6);
        cell.setHorizontalAlignment(align);
        return cell;
    }

    private static PdfPCell itemCell(String text, int align, Color background, Color color) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font(9, Font.NORMAL, color)));
        cell.setBackgroundColor(background);
        cell.setBorder(Rectangle.BOTTOM);
        cell.setBorderColor(RULE);
        cell.setPaddingTop(6);
        cell.setPaddingBottom(7);
        cell.setPaddingLeft(6);
        cell.setPaddingRight(6);
        cell.setHorizontalAlignment(align);
        return cell;
    }

    /** "Atlas Phone" -> "AP" (logo par défaut tant que la boutique n'a pas de logo). */
    private static String initials(String name) {
        StringBuilder out = new StringBuilder();
        for (String word : name.trim().split("\\s+")) {
            if (!word.isEmpty() && out.length() < 2) out.append(Character.toUpperCase(word.charAt(0)));
        }
        return out.length() == 0 ? "S" : out.toString();
    }

    private static void totalLine(PdfPTable table, String label, String value, boolean strong) {
        Font f = strong ? font(11, Font.BOLD, Color.WHITE) : font(9.5f, Font.NORMAL, DARK);
        PdfPCell l = new PdfPCell(new Phrase(label, f));
        PdfPCell v = new PdfPCell(new Phrase(value + " DH", f));
        for (PdfPCell c : List.of(l, v)) {
            c.setPaddingTop(strong ? 8 : 5);
            c.setPaddingBottom(strong ? 9 : 6);
            c.setPaddingLeft(8);
            c.setPaddingRight(8);
            c.setBorder(strong ? Rectangle.NO_BORDER : Rectangle.BOTTOM);
            c.setBorderColor(RULE);
            if (strong) c.setBackgroundColor(ACCENT);
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
