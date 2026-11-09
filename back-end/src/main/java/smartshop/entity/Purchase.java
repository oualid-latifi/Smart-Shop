package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "purchases")
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(name = "purchase_date", nullable = false)
    private LocalDateTime purchaseDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    // Reste à payer au fournisseur = total - amountPaid
    @Column(name = "amount_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(length = 255)
    private String note;

    // Marchandise renvoyée au fournisseur et argent qu'il nous a rendu (null pour les anciens achats = 0).
    // Reste à payer = total - retourné + remboursé - payé
    @Column(name = "returned_amount", precision = 12, scale = 2)
    private BigDecimal returnedAmount;

    @Column(name = "refund_received", precision = 12, scale = 2)
    private BigDecimal refundReceived;

    // Bon de commande d'origine (réception)
    @Column(name = "purchase_order_id")
    private UUID purchaseOrderId;

    @OneToMany(mappedBy = "purchase", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseLine> lines = new ArrayList<>();

    public Purchase() {
    }

    @PrePersist
    void onCreate() {
        this.purchaseDate = LocalDateTime.now();
    }

    public void addLine(PurchaseLine line) {
        line.setPurchase(this);
        this.lines.add(line);
    }

    public BigDecimal getRemaining() {
        return total.subtract(getReturnedAmount()).add(getRefundReceived()).subtract(amountPaid);
    }

    public BigDecimal getReturnedAmount() { return returnedAmount != null ? returnedAmount : BigDecimal.ZERO; }
    public void setReturnedAmount(BigDecimal returnedAmount) { this.returnedAmount = returnedAmount; }

    public BigDecimal getRefundReceived() { return refundReceived != null ? refundReceived : BigDecimal.ZERO; }
    public void setRefundReceived(BigDecimal refundReceived) { this.refundReceived = refundReceived; }

    public UUID getPurchaseOrderId() { return purchaseOrderId; }
    public void setPurchaseOrderId(UUID purchaseOrderId) { this.purchaseOrderId = purchaseOrderId; }

    public UUID getId() { return id; }

    public Supplier getSupplier() { return supplier; }
    public void setSupplier(Supplier supplier) { this.supplier = supplier; }

    public LocalDateTime getPurchaseDate() { return purchaseDate; }

    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public List<PurchaseLine> getLines() { return lines; }
}
