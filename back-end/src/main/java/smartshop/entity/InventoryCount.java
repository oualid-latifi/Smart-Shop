package smartshop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Inventaire physique : on fige le stock théorique à l'ouverture, on saisit les quantités comptées,
 * puis la clôture applique les écarts au stock (les ventes faites pendant le comptage sont conservées).
 */
@Entity
@Table(name = "inventory_counts")
public class InventoryCount {

    public enum Status { OPEN, CLOSED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 20, unique = true)
    private String number;

    @Column(name = "opened_at", nullable = false, updatable = false)
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private Status status = Status.OPEN;

    @Column(length = 255)
    private String note;

    @OneToMany(mappedBy = "inventory", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("productName asc")
    private List<InventoryCountLine> lines = new ArrayList<>();

    @PrePersist
    void onCreate() {
        this.openedAt = LocalDateTime.now();
    }

    public void addLine(InventoryCountLine line) {
        line.setInventory(this);
        lines.add(line);
    }

    public UUID getId() { return id; }

    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }

    public LocalDateTime getOpenedAt() { return openedAt; }

    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public List<InventoryCountLine> getLines() { return lines; }
}
