package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Remise de caisse : un employé remet l'argent encaissé au propriétaire. */
@Entity
@Table(name = "cash_handins")
public class CashHandin {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id")
    private AppUser employee;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "received_by", length = 100)
    private String receivedBy;

    @Column(length = 255)
    private String note;

    @Column(nullable = false)
    private LocalDateTime at;

    @PrePersist
    void onCreate() {
        this.at = LocalDateTime.now();
    }

    public UUID getId() { return id; }

    public AppUser getEmployee() { return employee; }
    public void setEmployee(AppUser employee) { this.employee = employee; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getReceivedBy() { return receivedBy; }
    public void setReceivedBy(String receivedBy) { this.receivedBy = receivedBy; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public LocalDateTime getAt() { return at; }
}
