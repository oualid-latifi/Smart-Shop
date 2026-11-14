package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Promotion sur une période : un produit précis, une marque, ou tout le magasin (les deux vides).
 * - PERCENT_OFF : -X % sur le prix
 * - FIXED_PRICE : prix promotionnel fixe (produit précis uniquement)
 * - SECOND_ITEM_PERCENT : le 2e article (puis 4e, 6e…) à -X %
 */
@Entity
@Table(name = "promotions")
public class Promotion {

    public enum Kind { PERCENT_OFF, FIXED_PRICE, SECOND_ITEM_PERCENT }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private Kind kind;

    // Pourcentage (PERCENT_OFF, SECOND_ITEM_PERCENT) ou prix en DH (FIXED_PRICE)
    @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal value;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(length = 80)
    private String brand;

    @Column(name = "starts_on", nullable = false)
    private LocalDate startsOn;

    @Column(name = "ends_on", nullable = false)
    private LocalDate endsOn;

    @Column(nullable = false)
    private Boolean active = true;

    /** La promotion concerne-t-elle ce produit ? */
    public boolean appliesTo(Product p) {
        if (product != null) return product.getId().equals(p.getId());
        if (brand != null) return brand.equalsIgnoreCase(p.getBrand() == null ? "" : p.getBrand().trim());
        return true;
    }

    public boolean isRunning(LocalDate day) {
        return Boolean.TRUE.equals(active) && !day.isBefore(startsOn) && !day.isAfter(endsOn);
    }

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Kind getKind() { return kind; }
    public void setKind(Kind kind) { this.kind = kind; }

    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }

    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public LocalDate getStartsOn() { return startsOn; }
    public void setStartsOn(LocalDate startsOn) { this.startsOn = startsOn; }

    public LocalDate getEndsOn() { return endsOn; }
    public void setEndsOn(LocalDate endsOn) { this.endsOn = endsOn; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
