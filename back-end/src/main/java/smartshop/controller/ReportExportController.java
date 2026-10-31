package smartshop.controller;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import smartshop.dto.ReportSummaryResponse;
import smartshop.service.ReportService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/reports/export")
public class ReportExportController {

    private static final String XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private final ReportService reportService;

    public ReportExportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/excel")
    public ResponseEntity<byte[]> excel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) throws IOException {
        ReportSummaryResponse report = reportService.summary(from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=smartshop-report.xlsx")
                .contentType(MediaType.parseMediaType(XLSX_TYPE))
                .body(buildWorkbook(report));
    }

    @GetMapping("/pdf")
    public ResponseEntity<byte[]> pdf(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ReportSummaryResponse report = reportService.summary(from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=smartshop-report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(buildPdf(report));
    }

    private byte[] buildWorkbook(ReportSummaryResponse r) throws IOException {
        java.util.ArrayList<String[]> rows = new java.util.ArrayList<>(List.of(
                new String[]{"SmartShop - Rapport", "Valeur"},
                new String[]{"Du", r.from().toString()},
                new String[]{"Au", r.to().toString()},
                new String[]{"Nombre de ventes", Long.toString(r.salesCount())},
                new String[]{"Chiffre d'affaires (DH)", r.revenue().toPlainString()},
                new String[]{"Coût des produits vendus (DH)", r.costOfGoodsSold().toPlainString()},
                new String[]{"Bénéfice brut (DH)", r.grossProfit().toPlainString()},
                new String[]{"Dépenses (DH)", r.expenses().toPlainString()},
                new String[]{"Bénéfice net (DH)", r.netProfit().toPlainString()},
                new String[]{"Argent encaissé (DH)", r.cashCollected().toPlainString()},
                new String[]{"Payé aux fournisseurs (DH)", r.paidToSuppliers().toPlainString()},
                new String[]{"Total achats (DH)", r.purchasesTotal().toPlainString()},
                new String[]{"Flux de trésorerie net (DH)", r.netCashFlow().toPlainString()},
                new String[]{"Dette clients (DH)", r.totalCustomerDebt().toPlainString()},
                new String[]{"Dette fournisseurs (DH)", r.totalSupplierDebt().toPlainString()},
                new String[]{"Valeur du stock (DH)", r.stockValue().toPlainString()},
                new String[]{"Produits en stock bas", Long.toString(r.lowStockCount())}
        ));
        rows.add(new String[]{"", ""});
        rows.add(new String[]{"Produits les plus vendus", "Quantité", "Chiffre d'affaires (DH)"});
        r.topProducts().forEach(p -> rows.add(new String[]{p.name(), Long.toString(p.quantitySold()), p.revenue().toPlainString()}));
        StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
                .append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        for (int i = 0; i < rows.size(); i++) {
            sheet.append("<row r=\"").append(i + 1).append("\">");
            for (int c = 0; c < rows.get(i).length; c++) {
                String cell = c == 0 ? "A" : c == 1 ? "B" : "C";
                String value = rows.get(i)[c];
                boolean numeric = i > 2 && !value.isBlank() && value.matches("-?\\d+(\\.\\d+)?");
                if (numeric) {
                    sheet.append("<c r=\"").append(cell).append(i + 1).append("\" t=\"n\"><v>").append(value).append("</v></c>");
                } else {
                    sheet.append("<c r=\"").append(cell).append(i + 1).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                            .append(xml(value)).append("</t></is></c>");
                }
            }
            sheet.append("</row>");
        }
        sheet.append("</sheetData></worksheet>");

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            put(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            put(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            put(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Rapport\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            put(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
            put(zip, "xl/worksheets/sheet1.xml", sheet.toString());
        }
        return bytes.toByteArray();
    }

    private byte[] buildPdf(ReportSummaryResponse r) {
        java.util.ArrayList<String> lines = new java.util.ArrayList<>(List.of(
                "SMARTSHOP - RAPPORT", "Periode : " + r.from() + " au " + r.to(),
                "Nombre de ventes : " + r.salesCount(),
                "Chiffre d'affaires : " + r.revenue() + " DH",
                "Cout des produits vendus : " + r.costOfGoodsSold() + " DH",
                "Benefice brut : " + r.grossProfit() + " DH",
                "Depenses : " + r.expenses() + " DH",
                "Benefice net : " + r.netProfit() + " DH",
                "Argent encaisse : " + r.cashCollected() + " DH",
                "Paye aux fournisseurs : " + r.paidToSuppliers() + " DH",
                "Achats : " + r.purchasesTotal() + " DH",
                "Flux net : " + r.netCashFlow() + " DH",
                "Dette clients : " + r.totalCustomerDebt() + " DH",
                "Dette fournisseurs : " + r.totalSupplierDebt() + " DH",
                "Valeur du stock : " + r.stockValue() + " DH",
                "Produits en stock bas : " + r.lowStockCount(),
                "Produits les plus vendus :"
        ));
        for (var product : r.topProducts()) {
            lines.add(product.name() + " | Quantite : " + product.quantitySold()
                    + " | Chiffre d'affaires : " + product.revenue() + " DH");
        }
        StringBuilder stream = new StringBuilder("BT\n/F1 16 Tf\n50 790 Td\n");
        for (int i = 0; i < lines.size(); i++) {
            if (i == 1) stream.append("/F1 10 Tf\n");
            if (i > 0) stream.append("0 -28 Td\n");
            stream.append('(').append(pdfSafe(lines.get(i))).append(") Tj\n");
        }
        stream.append("ET");
        byte[] content = stream.toString().getBytes(StandardCharsets.US_ASCII);
        String[] objects = new String[]{
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
                "<< /Length " + content.length + " >>\nstream\n" + new String(content, StandardCharsets.US_ASCII) + "\nendstream"
        };
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            out.write("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII));
            int[] offsets = new int[objects.length + 1];
            for (int i = 0; i < objects.length; i++) {
                offsets[i + 1] = out.size();
                out.write(((i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n").getBytes(StandardCharsets.US_ASCII));
            }
            int xref = out.size();
            out.write(("xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n").getBytes(StandardCharsets.US_ASCII));
            for (int i = 1; i < offsets.length; i++) out.write(String.format("%010d 00000 n \n", offsets[i]).getBytes(StandardCharsets.US_ASCII));
            out.write(("trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF").getBytes(StandardCharsets.US_ASCII));
        } catch (IOException impossible) {
            throw new IllegalStateException(impossible);
        }
        return out.toByteArray();
    }

    private static void put(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String xml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static String pdfSafe(String value) {
        return value.replaceAll("[^\\x20-\\x7E]", "?").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }
}
