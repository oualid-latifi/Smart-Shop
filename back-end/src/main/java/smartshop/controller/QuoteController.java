package smartshop.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.QuoteConvertRequest;
import smartshop.dto.QuoteRequest;
import smartshop.dto.QuoteResponse;
import smartshop.dto.SaleResponse;
import smartshop.entity.Quote;
import smartshop.entity.QuoteStatus;
import smartshop.service.DocumentPdfService;
import smartshop.service.QuoteService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    public record StatusRequest(@NotNull QuoteStatus status) {
    }

    private final QuoteService quoteService;
    private final DocumentPdfService pdfService;

    public QuoteController(QuoteService quoteService, DocumentPdfService pdfService) {
        this.quoteService = quoteService;
        this.pdfService = pdfService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuoteResponse create(@Valid @RequestBody QuoteRequest request) {
        return QuoteResponse.from(quoteService.create(request));
    }

    @GetMapping
    public List<QuoteResponse> findAll() {
        return quoteService.findAll().stream().map(QuoteResponse::from).toList();
    }

    @GetMapping("/{id}")
    public QuoteResponse findById(@PathVariable UUID id) {
        return QuoteResponse.from(quoteService.findById(id));
    }

    @PutMapping("/{id}/status")
    public QuoteResponse updateStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return QuoteResponse.from(quoteService.updateStatus(id, request.status()));
    }

    @PostMapping("/{id}/convert")
    @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse convert(@PathVariable UUID id, @Valid @RequestBody(required = false) QuoteConvertRequest request) {
        return SaleResponse.from(quoteService.convert(id, request != null ? request.amountPaid() : null));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID id) {
        Quote quote = quoteService.findById(id);
        return DocumentPdfService.inline(quote.getNumber() + ".pdf", pdfService.quote(quote));
    }
}
