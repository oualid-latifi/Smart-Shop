package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.QuoteRequest;
import smartshop.dto.SaleLineRequest;
import smartshop.dto.SaleRequest;
import smartshop.entity.Customer;
import smartshop.entity.DocumentType;
import smartshop.entity.Product;
import smartshop.entity.Quote;
import smartshop.entity.QuoteLine;
import smartshop.entity.QuoteStatus;
import smartshop.entity.Sale;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.CustomerRepository;
import smartshop.repository.ProductRepository;
import smartshop.repository.QuoteRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class QuoteService {

    private final QuoteRepository quoteRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final NumberingService numberingService;
    private final ShopSettingsService settingsService;
    private final SaleService saleService;

    public QuoteService(QuoteRepository quoteRepository,
                        CustomerRepository customerRepository,
                        ProductRepository productRepository,
                        NumberingService numberingService,
                        ShopSettingsService settingsService,
                        SaleService saleService) {
        this.quoteRepository = quoteRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.numberingService = numberingService;
        this.settingsService = settingsService;
        this.saleService = saleService;
    }

    @Transactional
    public Quote create(QuoteRequest request) {
        Customer customer = null;
        if (request.customerId() != null) {
            customer = customerRepository.findById(request.customerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client introuvable"));
        }

        Quote quote = new Quote();
        quote.setCustomer(customer);
        quote.setCustomerName(customer == null && request.customerName() != null && !request.customerName().isBlank()
                ? request.customerName().trim() : null);
        quote.setNote(request.note() != null && !request.note().isBlank() ? request.note().trim() : null);
        quote.setValidUntil(request.validUntil() != null
                ? request.validUntil()
                : LocalDate.now().plusDays(settingsService.get().getQuoteValidityDays()));

        BigDecimal subtotal = BigDecimal.ZERO;
        for (SaleLineRequest lineRequest : request.lines()) {
            Product product = productRepository.findById(lineRequest.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
            QuoteLine line = new QuoteLine();
            line.setProduct(product);
            line.setQuantity(lineRequest.quantity());
            line.setUnitPrice(lineRequest.unitPrice() != null ? lineRequest.unitPrice() : product.getSalePrice());
            quote.addLine(line);
            subtotal = subtotal.add(line.getLineTotal());
        }

        BigDecimal discount = request.discountPercent() != null
                ? subtotal.multiply(request.discountPercent()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : request.discount() != null ? request.discount() : BigDecimal.ZERO;
        if (discount.compareTo(subtotal) > 0) {
            throw new IllegalArgumentException("La remise dépasse le total du devis (" + subtotal + " DH)");
        }
        quote.setDiscount(discount);
        quote.setDiscountPercent(request.discountPercent());
        quote.setTotal(subtotal.subtract(discount));
        quote.setNumber(numberingService.next(DocumentType.QUOTE));
        return quoteRepository.save(quote);
    }

    @Transactional(readOnly = true)
    public List<Quote> findAll() {
        return quoteRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public Quote findById(UUID id) {
        return quoteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Devis introuvable"));
    }

    /** Le client accepte ou refuse le devis. */
    @Transactional
    public Quote updateStatus(UUID id, QuoteStatus status) {
        if (status != QuoteStatus.ACCEPTED && status != QuoteStatus.REJECTED && status != QuoteStatus.PENDING) {
            throw new IllegalArgumentException("Statut non modifiable directement : " + status);
        }
        Quote quote = findById(id);
        if (quote.getStatus() == QuoteStatus.CONVERTED) {
            throw new IllegalArgumentException("Ce devis a déjà été transformé en vente");
        }
        quote.setStatus(status);
        return quoteRepository.save(quote);
    }

    /** Transforme le devis en vente : le stock est alors déduit, aux prix du devis. */
    @Transactional
    public Sale convert(UUID id, BigDecimal amountPaid) {
        Quote quote = findById(id);
        if (quote.getStatus() == QuoteStatus.CONVERTED) {
            throw new IllegalArgumentException("Ce devis a déjà été transformé en vente");
        }
        if (quote.getStatus() == QuoteStatus.REJECTED) {
            throw new IllegalArgumentException("Ce devis a été refusé par le client");
        }

        List<SaleLineRequest> lines = quote.getLines().stream()
                .map(l -> new SaleLineRequest(l.getProduct().getId(), l.getQuantity(), l.getUnitPrice(), false))
                .toList();
        Sale sale = saleService.create(new SaleRequest(
                quote.getCustomer() != null ? quote.getCustomer().getId() : null,
                quote.getDiscount(),
                null,
                amountPaid,
                null,
                null,
                lines));

        quote.setStatus(QuoteStatus.CONVERTED);
        quote.setSaleId(sale.getId());
        quoteRepository.save(quote);
        return sale;
    }
}
