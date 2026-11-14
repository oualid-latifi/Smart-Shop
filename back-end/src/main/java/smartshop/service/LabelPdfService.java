package smartshop.service;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.Barcode;
import com.lowagie.text.pdf.Barcode128;
import com.lowagie.text.pdf.BarcodeEAN;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;
import smartshop.entity.Product;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Étiquettes produit : nom, prix et code-barres.
 * - A4 : planche de 3 × 8 étiquettes (format courant 70 × 37 mm)
 * - THERMAL : une étiquette 50 × 30 mm par page, pour imprimante d'étiquettes
 */
@Service
public class LabelPdfService {

    public enum Format { A4, THERMAL }

    private final ShopSettingsService settingsService;

    public LabelPdfService(ShopSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    /** prices : prix à imprimer par produit (prix promo éventuel), sinon prix de vente. */
    public byte[] labels(List<Product> products, int copies, Format format, Map<java.util.UUID, BigDecimal> prices) {
        String shop = settingsService.get().getShopName();
        List<Product> all = new ArrayList<>();
        for (Product p : products) for (int i = 0; i < Math.max(1, Math.min(copies, 100)); i++) all.add(p);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        boolean thermal = format == Format.THERMAL;
        Rectangle page = thermal ? new Rectangle(mm(50), mm(30)) : PageSize.A4;
        Document doc = thermal ? new Document(page, mm(2), mm(2), mm(1.5f), mm(1)) : new Document(page, mm(0), mm(0), mm(10.5f), mm(10.5f));
        PdfWriter writer = PdfWriter.getInstance(doc, out);
        doc.open();
        PdfContentByte cb = writer.getDirectContent();

        if (thermal) {
            for (int i = 0; i < all.size(); i++) {
                if (i > 0) doc.newPage();
                PdfPTable one = new PdfPTable(1);
                one.setWidthPercentage(100);
                one.addCell(labelCell(all.get(i), shop, prices, cb, mm(26), true));
                doc.add(one);
            }
        } else {
            PdfPTable grid = new PdfPTable(3);
            grid.setWidthPercentage(100);
            for (Product p : all) grid.addCell(labelCell(p, shop, prices, cb, mm(34.5f), false));
            // Compléter la dernière ligne de la planche
            int rest = (3 - all.size() % 3) % 3;
            for (int i = 0; i < rest; i++) {
                PdfPCell empty = new PdfPCell();
                empty.setBorder(Rectangle.NO_BORDER);
                empty.setFixedHeight(mm(34.5f));
                grid.addCell(empty);
            }
            doc.add(grid);
        }
        doc.close();
        return out.toByteArray();
    }

    private PdfPCell labelCell(Product p, String shop, Map<java.util.UUID, BigDecimal> prices, PdfContentByte cb, float height, boolean thermal) {
        PdfPCell cell = new PdfPCell();
        cell.setFixedHeight(height);
        cell.setPadding(thermal ? 1 : 6);
        cell.setBorder(thermal ? Rectangle.NO_BORDER : Rectangle.BOX);
        cell.setBorderColor(new Color(225, 230, 238));
        cell.setVerticalAlignment(Element.ALIGN_MIDDLE);

        // Une ligne par information : le texte ne chevauche jamais le code-barres
        PdfPTable inner = new PdfPTable(1);
        inner.setWidthPercentage(100);
        if (shop != null && !thermal) inner.addCell(textRow(shop, font(6.5f, Font.NORMAL, Color.GRAY)));
        String name = p.getName() + (p.getCapacity() != null ? " " + p.getCapacity() : "") + (p.getColor() != null ? " " + p.getColor() : "");
        inner.addCell(textRow(name, font(thermal ? 7 : 8, Font.BOLD, Color.BLACK)));
        BigDecimal price = prices.getOrDefault(p.getId(), p.getSalePrice());
        inner.addCell(textRow(DocumentPdfService.money(price) + " DH", font(thermal ? 11 : 13, Font.BOLD, Color.BLACK)));

        Barcode barcode = barcodeFor(p);
        barcode.setBarHeight(thermal ? 18 : 22);
        barcode.setX(thermal ? 0.7f : 0.8f);
        barcode.setSize(6.5f);
        Image image = barcode.createImageWithBarcode(cb, Color.BLACK, Color.BLACK);
        image.scaleToFit(thermal ? mm(44) : mm(58), thermal ? mm(11) : mm(13));
        PdfPCell code = new PdfPCell(image, false);
        code.setBorder(Rectangle.NO_BORDER);
        code.setHorizontalAlignment(Element.ALIGN_CENTER);
        code.setPaddingTop(2);
        inner.addCell(code);

        cell.addElement(inner);
        return cell;
    }

    private static PdfPCell textRow(String text, Font font) {
        PdfPCell row = new PdfPCell(new com.lowagie.text.Phrase(text, font));
        row.setBorder(Rectangle.NO_BORDER);
        row.setHorizontalAlignment(Element.ALIGN_CENTER);
        row.setPadding(0);
        row.setPaddingBottom(1);
        return row;
    }

    /** EAN-13 si le code-barres du produit en est un, sinon Code 128 (code-barres ou référence). */
    private static Barcode barcodeFor(Product p) {
        String code = p.getBarcode() != null ? p.getBarcode() : p.getReference();
        if (code.matches("\\d{13}") && validEan13(code)) {
            BarcodeEAN ean = new BarcodeEAN();
            ean.setCodeType(Barcode.EAN13);
            ean.setCode(code);
            return ean;
        }
        Barcode128 c128 = new Barcode128();
        c128.setCode(code);
        return c128;
    }

    private static boolean validEan13(String code) {
        int sum = 0;
        for (int i = 0; i < 12; i++) sum += (code.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
        return (10 - sum % 10) % 10 == code.charAt(12) - '0';
    }

    private static Paragraph centered(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_CENTER);
        p.setLeading(font.getSize() * 1.15f);
        return p;
    }

    private static Font font(float size, int style, Color color) {
        return FontFactory.getFont(FontFactory.HELVETICA, "Cp1252", false, size, style, color);
    }

    private static float mm(float mm) {
        return mm * 72f / 25.4f;
    }
}
