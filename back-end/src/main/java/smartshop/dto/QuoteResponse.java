package smartshop.dto;

import smartshop.entity.Quote;
import smartshop.entity.QuoteLine;
import smartshop.entity.QuoteStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record QuoteResponse(
        UUID id,
        String number,
        UUID customerId,
        String customerName,
        String customerPhone,
        LocalDateTime createdAt,
        LocalDate validUntil,
        BigDecimal discount,
        BigDecimal discountPercent,
        BigDecimal total,
        QuoteStatus status,
        String note,
        UUID saleId,
        List<Line> lines
) {

    public record Line(UUID productId, String productName, Integer quantity, BigDecimal unitPrice, BigDecimal lineTotal) {
        static Line from(QuoteLine l) {
            return new Line(l.getProduct().getId(), l.getProduct().getName(), l.getQuantity(), l.getUnitPrice(), l.getLineTotal());
        }
    }

    public static QuoteResponse from(Quote q) {
        return new QuoteResponse(
                q.getId(),
                q.getNumber(),
                q.getCustomer() != null ? q.getCustomer().getId() : null,
                q.getCustomer() != null ? q.getCustomer().getName() : q.getCustomerName(),
                q.getCustomer() != null ? q.getCustomer().getPhone() : null,
                q.getCreatedAt(),
                q.getValidUntil(),
                q.getDiscount(),
                q.getDiscountPercent(),
                q.getTotal(),
                q.getEffectiveStatus(),
                q.getNote(),
                q.getSaleId(),
                q.getLines().stream().map(Line::from).toList());
    }
}
