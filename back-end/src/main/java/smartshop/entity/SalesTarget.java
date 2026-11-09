package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

/** Objectif de chiffre d'affaires d'un vendeur pour un mois (format "2026-11"). */
@Entity
@Table(name = "sales_targets", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "target_month"}))
public class SalesTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "target_month", nullable = false, length = 7)
    private String month;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    public UUID getId() { return id; }

    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }

    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
