package smartshop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Notification de la boutique (stock bas, chèque à échéance, grosse vente, objectif atteint).
 * "audience" = droit nécessaire pour la voir (null = tout le monde) ; lue par compte.
 */
@Entity
@Table(name = "notifications", indexes = @Index(name = "idx_notification_created", columnList = "created_at"))
public class Notification {

    public enum Type { LOW_STOCK, CHECK_DUE, BIG_SALE, TARGET_REACHED, BACKUP_FAILED, ONLINE_ORDER }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 255)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Permission audience;

    // Objet concerné (produit, chèque, vente…) et clé anti-doublon (ex. un rappel par chèque et par jour)
    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "dedupe_key", length = 120, unique = true)
    private String dedupeKey;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ElementCollection
    @CollectionTable(name = "notification_reads", joinColumns = @JoinColumn(name = "notification_id"))
    @Column(name = "user_id")
    private Set<UUID> readBy = new HashSet<>();

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }

    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }

    public Permission getAudience() { return audience; }
    public void setAudience(Permission audience) { this.audience = audience; }

    public UUID getReferenceId() { return referenceId; }
    public void setReferenceId(UUID referenceId) { this.referenceId = referenceId; }

    public String getDedupeKey() { return dedupeKey; }
    public void setDedupeKey(String dedupeKey) { this.dedupeKey = dedupeKey; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public Set<UUID> getReadBy() { return readBy; }
}
