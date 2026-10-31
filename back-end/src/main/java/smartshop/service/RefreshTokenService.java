package smartshop.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.AppUser;
import smartshop.exception.InvalidRefreshTokenException;
import smartshop.entity.RefreshSession;
import smartshop.repository.RefreshSessionRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;

@Service
public class RefreshTokenService {
    public record IssuedRefreshToken(String token, Instant expiresAt, UUID userId) {}
    private final RefreshSessionRepository sessions;
    private final SecureRandom random = new SecureRandom();
    private final long lifetimeDays;

    public RefreshTokenService(RefreshSessionRepository sessions,
            @Value("${app.refresh.expiration-days:30}") long lifetimeDays) {
        this.sessions = sessions;
        this.lifetimeDays = lifetimeDays;
    }

    @Transactional
    public IssuedRefreshToken create(AppUser user) {
        return create(user, UUID.randomUUID());
    }

    private IssuedRefreshToken create(AppUser user, UUID familyId) {
        byte[] bytes = new byte[64];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiry = Instant.now().plus(lifetimeDays, ChronoUnit.DAYS);
        sessions.save(new RefreshSession(user, hash(raw), familyId, expiry));
        return new IssuedRefreshToken(raw, expiry, user.getId());
    }

    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public IssuedRefreshToken rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) throw new IllegalArgumentException("Refresh token invalide");
        String hash = hash(rawToken);
        RefreshSession session = sessions.findForUpdateByTokenHash(hash)
                .orElseThrow(() -> new IllegalArgumentException("Session expirée ou invalide"));
        if (session.getRevokedAt() != null) {
            sessions.revokeFamily(session.getFamilyId());
            throw new IllegalArgumentException("Réutilisation d'un ancien token : session révoquée");
        }
        if (!session.getExpiresAt().isAfter(Instant.now())) {
            session.revoke();
            throw new IllegalArgumentException("Session expirée");
        }
        session.revoke();
        return create(session.getUser(), session.getFamilyId());
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        sessions.findForUpdateByTokenHash(hash(rawToken)).ifPresent(RefreshSession::revoke);
    }

    @Transactional
    public void revokeAll(UUID userId) {
        sessions.revokeAllForUser(userId);
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }
}