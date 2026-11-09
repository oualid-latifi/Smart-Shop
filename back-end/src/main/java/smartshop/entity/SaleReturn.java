package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Retour d'articles sur une vente (avoir). La valeur reprise réduit d'abord la dette de la vente ;
 * si le client avait déjà payé, la différence lui est remboursée.
 */
@Entity
@Table(name = "sale_returns")
public class SaleReturn {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @Column(name = "returned_at", nullable = false)
    private LocalDateTime returnedAt;

    // Valeur des articles repris (remise de la vente déduite au prorata)
    @Column(name = "credit_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal creditAmount;

    // Argent rendu au client
    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "refund_method", length = 15)
    private PaymentMethod refundMethod;

    @Column(length = 255)
    private String reason;

    @OneToMany(mappedBy = "saleReturn", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleReturnLine> lines = new ArrayList<>();

    @PrePersist
    void onCreate() {
        this.returnedAt = LocalDateTime.now();
    }

    public void addLine(SaleReturnLine line) {
        line.setSaleReturn(this);
        lines.add(line);
    }

    public UUID getId() { return id; }

    public Sale getSale() { return sale; }
    public void setSale(Sale sale) { this.sale = sale; }

    public LocalDateTime getReturnedAt() { return returnedAt; }

    public BigDecimal getCreditAmount() { return creditAmount; }
    public void setCreditAmount(BigDecimal creditAmount) { this.creditAmount = creditAmount; }

    public BigDecimal getRefundAmount() { return refundAmount; }
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }

    public PaymentMethod getRefundMethod() { return refundMethod; }
    public void setRefundMethod(PaymentMethod refundMethod) { this.refundMethod = refundMethod; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public List<SaleReturnLine> getLines() { return lines; }
}
