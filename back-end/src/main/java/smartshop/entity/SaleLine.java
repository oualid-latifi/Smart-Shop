package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "sale_lines")
public class SaleLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    // Vente au carton : nombre de cartons et prix d'un carton (null = vente à l'unité).
    // quantity reste toujours exprimée en unités pour le stock.
    @Column(name = "pack_count")
    private Integer packCount;

    @Column(name = "pack_price", precision = 12, scale = 2)
    private BigDecimal packPrice;

    // Prix d'achat moyen AU MOMENT de la vente (sert à calculer le bénéfice)
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    public SaleLine() {
    }

    public UUID getId() { return id; }

    public Sale getSale() { return sale; }
    public void setSale(Sale sale) { this.sale = sale; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public Integer getPackCount() { return packCount; }
    public void setPackCount(Integer packCount) { this.packCount = packCount; }

    public BigDecimal getPackPrice() { return packPrice; }
    public void setPackPrice(BigDecimal packPrice) { this.packPrice = packPrice; }

    /** Montant exact de la ligne (au carton, le prix du carton fait foi). */
    public BigDecimal getLineTotal() {
        return packCount != null ? packPrice.multiply(BigDecimal.valueOf(packCount)) : unitPrice.multiply(BigDecimal.valueOf(quantity));
    }

    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }
}
