package smartshop.entity;

import jakarta.persistence.*;
import java.util.UUID;

/**
 * Dépôt de stockage en plus de la boutique. La boutique elle-même n'est pas un dépôt :
 * son stock reste celui du produit (Product.stockQuantity), utilisé par les ventes et les achats.
 * Un dépôt QUARANTINE isole les articles abîmés ou périmés (non vendables, hors valeur du stock).
 */
@Entity
@Table(name = "warehouses")
public class Warehouse {

    public enum Type { STORAGE, QUARANTINE }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private Type type = Type.STORAGE;

    @Column(nullable = false)
    private Boolean active = true;

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
