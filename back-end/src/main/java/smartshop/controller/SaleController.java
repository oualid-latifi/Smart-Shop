package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.CancelSaleRequest;
import smartshop.dto.SaleRequest;
import smartshop.dto.SaleResponse;
import smartshop.entity.Sale;
import smartshop.service.DocumentPdfService;
import smartshop.service.SaleService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

    private final SaleService saleService;
    private final DocumentPdfService pdfService;

    public SaleController(SaleService saleService, DocumentPdfService pdfService) {
        this.saleService = saleService;
        this.pdfService = pdfService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse create(@Valid @RequestBody SaleRequest request) {
        return SaleResponse.from(saleService.create(request));
    }

    @GetMapping
    public List<SaleResponse> findAll(@RequestParam(required = false) Integer limit) {
        List<smartshop.entity.Sale> sales = limit != null ? saleService.findRecent(limit) : saleService.findAll();
        return sales.stream().map(SaleResponse::from).toList();
    }

    @GetMapping("/{id}")
    public SaleResponse findById(@PathVariable UUID id) {
        return SaleResponse.from(saleService.findById(id));
    }

    @PostMapping("/{id}/cancel")
    public SaleResponse cancel(@PathVariable UUID id,
                               @Valid @RequestBody CancelSaleRequest request) {
        return SaleResponse.from(saleService.cancel(id, request.reason()));
    }

    @PostMapping("/{id}/returns")
    @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse createReturn(@PathVariable UUID id, @Valid @RequestBody smartshop.dto.SaleReturnRequest request) {
        return SaleResponse.from(saleService.createReturn(id, request));
    }

    // ---- Documents : la facture et le BL reçoivent leur numéro à la première demande

    @PostMapping("/{id}/invoice")
    public SaleResponse issueInvoice(@PathVariable UUID id) {
        return SaleResponse.from(saleService.issueInvoice(id));
    }

    @PostMapping("/{id}/delivery-note")
    public SaleResponse issueDeliveryNote(@PathVariable UUID id) {
        return SaleResponse.from(saleService.issueDeliveryNote(id));
    }

    @GetMapping("/{id}/invoice.pdf")
    public ResponseEntity<byte[]> invoicePdf(@PathVariable UUID id) {
        Sale sale = saleService.issueInvoice(id);
        return DocumentPdfService.inline(sale.getInvoiceNumber() + ".pdf", pdfService.invoice(sale));
    }

    @GetMapping("/{id}/delivery-note.pdf")
    public ResponseEntity<byte[]> deliveryNotePdf(@PathVariable UUID id) {
        Sale sale = saleService.issueDeliveryNote(id);
        return DocumentPdfService.inline(sale.getDeliveryNumber() + ".pdf", pdfService.deliveryNote(sale));
    }

    // Ticket de caisse pour imprimante thermique : width = 58 ou 80 (mm)
    @GetMapping("/{id}/ticket.pdf")
    public ResponseEntity<byte[]> ticketPdf(@PathVariable UUID id, @RequestParam(defaultValue = "80") int width) {
        Sale sale = saleService.findById(id);
        return DocumentPdfService.inline(sale.getDisplayNumber() + ".pdf", pdfService.ticket(sale, width));
    }
}
