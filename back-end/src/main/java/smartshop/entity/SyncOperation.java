package smartshop.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Opération envoyée par un téléphone (vente, client, paiement faits hors-ligne), mémorisée par son
 * identifiant : si le téléphone la renvoie (réseau coupé avant la réponse), elle n'est jamais appliquée deux fois.
 */
@Entity
@Table(name = "sync_operations")
public class SyncOperation {

    public enum Type { SALE_CREATE, CUSTOMER_CREATE, PAYMENT_CREATE }

    @Id
    @Column(name = "op_id", length = 40)
    private String opId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type;

    // Vente, client ou client payé créé par cette opération
    @Column(name = "result_id")
    private UUID resultId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "processed_at", nullable = false)
    private LocalDateTime processedAt;

    protected SyncOperation() {
    }

    public SyncOperation(String opId, Type type, UUID resultId, UUID userId) {
        this.opId = opId;
        this.type = type;
        this.resultId = resultId;
        this.userId = userId;
        this.processedAt = LocalDateTime.now();
    }

    public String getOpId() { return opId; }
    public Type getType() { return type; }
    public UUID getResultId() { return resultId; }
    public UUID getUserId() { return userId; }
    public LocalDateTime getProcessedAt() { return processedAt; }
}
