package smartshop.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

// Le compte du propriétaire de la boutique (un seul compte)
@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    // Mot de passe chiffré (BCrypt) : jamais en clair
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    // Augmente à chaque changement de mot de passe : les anciens tokens (autres appareils) deviennent invalides
    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public AppUser() {
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public int getTokenVersion() { return tokenVersion; }
    public void setTokenVersion(int tokenVersion) { this.tokenVersion = tokenVersion; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}