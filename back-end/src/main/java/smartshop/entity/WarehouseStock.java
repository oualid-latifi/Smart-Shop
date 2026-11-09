package smartshop.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "warehouse_stocks", uniqueConstraints = @UniqueConstraint(columnNames = {"warehouse_id", "product_id"}))
public class WarehouseStock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private Integer quantity = 0;

    protected WarehouseStock() {
    }

    public WarehouseStock(Warehouse warehouse, Product product) {
        this.warehouse = warehouse;
        this.product = product;
    }

    public UUID getId() { return id; }

    public Warehouse getWarehouse() { return warehouse; }

    public Product getProduct() { return product; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
}
