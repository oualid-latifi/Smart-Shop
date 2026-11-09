package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "sales")
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Numéro du ticket de vente (VT-2026-00001). Null pour les ventes créées avant la numérotation.
    @Column(length = 20, unique = true)
    private String number;

    // Facture émise à la demande du client (FAC-2026-00001)
    @Column(name = "invoice_number", length = 20, unique = true)
    private String invoiceNumber;

    @Column(name = "invoice_date")
    private LocalDateTime invoiceDate;

    // Bon de livraison (BL-2026-00001)
    @Column(name = "delivery_number", length = 20, unique = true)
    private String deliveryNumber;

    // Remise saisie en pourcentage (null si saisie en DH)
    @Column(name = "discount_percent", precision = 5, scale = 2)
    private BigDecimal discountPercent;

    // null = client de passage
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    // Employé qui a fait la vente (null pour les ventes antérieures aux comptes multiples)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id")
    private AppUser seller;

    @Column(name = "sale_date", nullable = false)
    private LocalDateTime saleDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    // Total après remise
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    // Reste en kridi = total - amountPaid
    @Column(name = "amount_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private SaleStatus status = SaleStatus.VALIDATED;

    // Mode du paiement encaissé à la vente (null pour les anciennes ventes = espèces)
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 15)
    private PaymentMethod paymentMethod;

    // Valeur des articles repris (retours) et argent rendu au client.
    // Reste dû = total - repris + remboursé - payé. Null pour les anciennes ventes = 0.
    @Column(name = "returned_amount", precision = 12, scale = 2)
    private BigDecimal returnedAmount;

    @Column(name = "refunded_amount", precision = 12, scale = 2)
    private BigDecimal refundedAmount;

    @OneToMany(mappedBy = "sale")
    @OrderBy("returnedAt asc")
    private List<SaleReturn> returns = new ArrayList<>();

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancellation_reason", length = 255)
    private String cancellationReason;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleLine> lines = new ArrayList<>();

    public Sale() {
    }

    @PrePersist
    void onCreate() {
        this.saleDate = LocalDateTime.now();
    }

    public void addLine(SaleLine line) {
        line.setSale(this);
        this.lines.add(line);
    }

    public BigDecimal getRemaining() {
        return getNetTotal().add(getRefundedAmount()).subtract(amountPaid);
    }

    /** Total après retours. */
    public BigDecimal getNetTotal() {
        return total.subtract(getReturnedAmount());
    }

    // Bénéfice = total net (après remise et retours) - coût des articles gardés par le client
    public BigDecimal getProfit() {
        BigDecimal cost = lines.stream()
                .map(l -> l.getUnitCost().multiply(BigDecimal.valueOf(l.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal returnedCost = returns.stream().flatMap(r -> r.getLines().stream())
                .map(l -> l.getUnitCost().multiply(BigDecimal.valueOf(l.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return getNetTotal().subtract(cost.subtract(returnedCost));
    }

    /** Quantité déjà retournée pour un produit de cette vente. */
    public int getReturnedQuantity(UUID productId) {
        return returns.stream().flatMap(r -> r.getLines().stream())
                .filter(l -> l.getProduct().getId().equals(productId))
                .mapToInt(SaleReturnLine::getQuantity).sum();
    }

    public UUID getId() { return id; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public LocalDateTime getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(LocalDateTime invoiceDate) { this.invoiceDate = invoiceDate; }

    public String getDeliveryNumber() { return deliveryNumber; }
    public void setDeliveryNumber(String deliveryNumber) { this.deliveryNumber = deliveryNumber; }

    public BigDecimal getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(BigDecimal discountPercent) { this.discountPercent = discountPercent; }

    /** Numéro affiché : celui de la vente, ou un numéro court tiré de l'identifiant pour les anciennes ventes. */
    public String getDisplayNumber() {
        return number != null ? number : "VT-" + id.toString().substring(0, 8).toUpperCase();
    }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }

    public AppUser getSeller() { return seller; }
    public void setSeller(AppUser seller) { this.seller = seller; }

    public LocalDateTime getSaleDate() { return saleDate; }

    public BigDecimal getDiscount() { return discount; }
    public void setDiscount(BigDecimal discount) { this.discount = discount; }

    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public PaymentMethod getPaymentMethod() { return paymentMethod != null ? paymentMethod : PaymentMethod.CASH; }
    public void setPaymentMethod(PaymentMethod paymentMethod) { this.paymentMethod = paymentMethod; }

    public BigDecimal getReturnedAmount() { return returnedAmount != null ? returnedAmount : BigDecimal.ZERO; }
    public void setReturnedAmount(BigDecimal returnedAmount) { this.returnedAmount = returnedAmount; }

    public BigDecimal getRefundedAmount() { return refundedAmount != null ? refundedAmount : BigDecimal.ZERO; }
    public void setRefundedAmount(BigDecimal refundedAmount) { this.refundedAmount = refundedAmount; }

    public List<SaleReturn> getReturns() { return returns; }

    public SaleStatus getStatus() { return status; }
    public void setStatus(SaleStatus status) { this.status = status; }

    public LocalDateTime getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(LocalDateTime cancelledAt) { this.cancelledAt = cancelledAt; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }

    public List<SaleLine> getLines() { return lines; }
}
