package smartshop.controller;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import smartshop.dto.ReportSummaryResponse;
import smartshop.dto.PaymentHistoryResponse;
import smartshop.dto.RefundResponse;
import java.util.List;
import smartshop.service.ReportService;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    // Exemple : GET /api/reports/summary?from=2026-10-01&to=2026-10-31
    @GetMapping("/summary")
    public ReportSummaryResponse summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.summary(from, to);
    }

    @GetMapping("/refund-history")
    public List<RefundResponse> refundHistory() {
        return reportService.refundHistory();
    }

    @GetMapping("/payment-history")
    public PaymentHistoryResponse paymentHistory() {
        return reportService.paymentHistory();
    }

    @GetMapping("/today")
    public ReportSummaryResponse today() {
        return reportService.today();
    }

    @GetMapping("/this-week")
    public ReportSummaryResponse thisWeek() {
        return reportService.thisWeek();
    }

    @GetMapping("/this-month")
    public ReportSummaryResponse thisMonth() {
        return reportService.thisMonth();
    }
}
