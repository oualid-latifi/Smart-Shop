package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "sale_refund_lines")
public class SaleRefundLine {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "refund_id", nullable = false)
    private SaleRefund refund;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_line_id", nullable = false)
    private SaleLine saleLine;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount;

    public SaleRefundLine() {}

    public UUID getId() { return id; }
    public SaleRefund getRefund() { return refund; }
    public void setRefund(SaleRefund refund) { this.refund = refund; }
    public SaleLine getSaleLine() { return saleLine; }
    public void setSaleLine(SaleLine saleLine) { this.saleLine = saleLine; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public BigDecimal getRefundAmount() { return refundAmount; }
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }
}
