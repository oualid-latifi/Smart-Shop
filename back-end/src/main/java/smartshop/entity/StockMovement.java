package smartshop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockMovementType type;

    // Positif = entrée, négatif = sortie
    @Column(nullable = false)
    private Integer quantity;

    // Id de l'achat ou de la vente concernée
    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 255)
    private String note;

    public StockMovement() {
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public StockMovementType getType() { return type; }
    public void setType(StockMovementType type) { this.type = type; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public UUID getReferenceId() { return referenceId; }
    public void setReferenceId(UUID referenceId) { this.referenceId = referenceId; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
