package smartshop.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Commande passée par un client sur la boutique en ligne (CMD-2026-00001), transformée ensuite en vente. */
@Entity
@Table(name = "online_orders")
public class OnlineOrder {

    public enum Status { NEW, CONFIRMED, CONVERTED, CANCELLED }

    @Embeddable
    public static class Line {
        @Column(name = "product_id", nullable = false)
        private UUID productId;

        @Column(name = "product_name", nullable = false, length = 150)
        private String productName;

        @Column(nullable = false)
        private Integer quantity;

        @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
        private BigDecimal unitPrice;

        protected Line() {
        }

        public Line(UUID productId, String productName, int quantity, BigDecimal unitPrice) {
            this.productId = productId;
            this.productName = productName;
            this.quantity = quantity;
            this.unitPrice = unitPrice;
        }

        public UUID getProductId() { return productId; }
        public String getProductName() { return productName; }
        public Integer getQuantity() { return quantity; }
        public BigDecimal getUnitPrice() { return unitPrice; }
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 20, unique = true)
    private String number;

    @Column(name = "customer_name", nullable = false, length = 100)
    private String customerName;

    @Column(nullable = false, length = 30)
    private String phone;

    @Column(length = 255)
    private String address;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private Status status = Status.NEW;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Vente créée à partir de cette commande
    @Column(name = "sale_id")
    private UUID saleId;

    @ElementCollection
    @CollectionTable(name = "online_order_lines", joinColumns = @JoinColumn(name = "order_id"))
    @OrderColumn(name = "position")
    private List<Line> lines = new ArrayList<>();

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public UUID getSaleId() { return saleId; }
    public void setSaleId(UUID saleId) { this.saleId = saleId; }
    public List<Line> getLines() { return lines; }
}
