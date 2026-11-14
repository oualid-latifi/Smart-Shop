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

@RestController
@RequestMapping("/api/reports/export")
public class ReportExportController {

    private static final String XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private final ReportService reportService;
    private final smartshop.service.ExcelReportService excelReportService;

    public ReportExportController(ReportService reportService, smartshop.service.ExcelReportService excelReportService) {
        this.reportService = reportService;
        this.excelReportService = excelReportService;
    }

    @GetMapping("/excel")
    public ResponseEntity<byte[]> excel(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) throws IOException {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.withDayOfMonth(1);
        String name = "rapport-" + start + "-au-" + end + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.parseMediaType(XLSX_TYPE))
                .body(excelReportService.build(start, end));
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

    private byte[] buildPdf(ReportSummaryResponse r) {
        List<String> lines = List.of(
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
        );
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

    private static String pdfSafe(String value) {
        return value.replaceAll("[^\\x20-\\x7E]", "?").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }
}
