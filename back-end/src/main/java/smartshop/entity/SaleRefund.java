package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sale_refunds")
public class SaleRefund {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "credit_applied", nullable = false, precision = 12, scale = 2)
    private BigDecimal creditApplied = BigDecimal.ZERO;

    @Column(name = "cash_refunded", nullable = false, precision = 12, scale = 2)
    private BigDecimal cashRefunded = BigDecimal.ZERO;

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(name = "refunded_at", nullable = false)
    private LocalDateTime refundedAt;

    @OneToMany(mappedBy = "refund", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleRefundLine> lines = new ArrayList<>();

    public SaleRefund() {}

    @PrePersist
    void onCreate() { if (refundedAt == null) refundedAt = LocalDateTime.now(); }

    public void addLine(SaleRefundLine line) {
        line.setRefund(this);
        lines.add(line);
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public void setRefundedAt(LocalDateTime refundedAt) { this.refundedAt = refundedAt; }
    public Sale getSale() { return sale; }
    public void setSale(Sale sale) { this.sale = sale; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getCreditApplied() { return creditApplied; }
    public void setCreditApplied(BigDecimal creditApplied) { this.creditApplied = creditApplied; }
    public BigDecimal getCashRefunded() { return cashRefunded; }
    public void setCashRefunded(BigDecimal cashRefunded) { this.cashRefunded = cashRefunded; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LocalDateTime getRefundedAt() { return refundedAt; }
    public List<SaleRefundLine> getLines() { return lines; }
}
