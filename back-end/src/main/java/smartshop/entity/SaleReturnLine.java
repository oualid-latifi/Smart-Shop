package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "sale_return_lines")
public class SaleReturnLine {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_return_id")
    private SaleReturn saleReturn;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    // Coût d'achat de la ligne vendue : sert à corriger le coût des ventes dans les rapports
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitCost;

    // false = article abîmé : il n'est pas remis en stock vendable
    @Column(nullable = false)
    private Boolean restocked = true;

    public UUID getId() { return id; }

    public SaleReturn getSaleReturn() { return saleReturn; }
    public void setSaleReturn(SaleReturn saleReturn) { this.saleReturn = saleReturn; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }

    public Boolean getRestocked() { return restocked; }
    public void setRestocked(Boolean restocked) { this.restocked = restocked; }
}
