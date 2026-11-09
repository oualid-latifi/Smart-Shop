package smartshop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/** Journal d'activité : qui a fait quoi, et quand. */
@Entity
@Table(name = "activity_logs", indexes = @Index(name = "idx_activity_at", columnList = "at"))
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    // Copie du nom : le journal reste lisible même si le compte est renommé
    @Column(name = "user_name", length = 100)
    private String userName;

    @Column(nullable = false, length = 120)
    private String action;

    @Column(name = "http_method", nullable = false, length = 10)
    private String method;

    @Column(nullable = false, length = 255)
    private String path;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(nullable = false)
    private LocalDateTime at;

    @PrePersist
    void onCreate() {
        this.at = LocalDateTime.now();
    }

    public UUID getId() { return id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public UUID getTargetId() { return targetId; }
    public void setTargetId(UUID targetId) { this.targetId = targetId; }

    public LocalDateTime getAt() { return at; }
}
