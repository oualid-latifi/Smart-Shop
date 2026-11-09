package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "inventory_count_lines")
public class InventoryCountLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_id")
    private InventoryCount inventory;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    // Copie du nom pour trier et afficher sans charger le produit
    @Column(name = "product_name", nullable = false, length = 150)
    private String productName;

    // Stock théorique au moment de l'ouverture
    @Column(name = "expected_quantity", nullable = false)
    private Integer expectedQuantity;

    // null = pas encore compté (ignoré à la clôture)
    @Column(name = "counted_quantity")
    private Integer countedQuantity;

    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    public Integer getDifference() {
        return countedQuantity == null ? null : countedQuantity - expectedQuantity;
    }

    public BigDecimal getDifferenceValue() {
        Integer diff = getDifference();
        return diff == null ? BigDecimal.ZERO : unitCost.multiply(BigDecimal.valueOf(diff));
    }

    public UUID getId() { return id; }

    public InventoryCount getInventory() { return inventory; }
    public void setInventory(InventoryCount inventory) { this.inventory = inventory; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public Integer getExpectedQuantity() { return expectedQuantity; }
    public void setExpectedQuantity(Integer expectedQuantity) { this.expectedQuantity = expectedQuantity; }

    public Integer getCountedQuantity() { return countedQuantity; }
    public void setCountedQuantity(Integer countedQuantity) { this.countedQuantity = countedQuantity; }

    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }
}
