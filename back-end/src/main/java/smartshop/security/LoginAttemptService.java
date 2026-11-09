package smartshop.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import smartshop.exception.TooManyAttemptsException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Protection contre la force brute (OWASP ASVS 2.2.1) : après N échecs pour un même email,
 * la connexion est bloquée pendant quelques minutes. Les compteurs sont en mémoire,
 * ce qui suffit pour un serveur unique.
 */
@Service
public class LoginAttemptService {

    private record Attempts(int failures, Instant lockedUntil) {
    }

    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final int maxAttempts;
    private final Duration lockDuration;
    private final Clock clock;

    @Autowired
    public LoginAttemptService(@Value("${app.security.login.max-attempts:5}") int maxAttempts,
                               @Value("${app.security.login.lock-minutes:15}") long lockMinutes) {
        this(maxAttempts, Duration.ofMinutes(lockMinutes), Clock.systemUTC());
    }

    LoginAttemptService(int maxAttempts, Duration lockDuration, Clock clock) {
        this.maxAttempts = maxAttempts;
        this.lockDuration = lockDuration;
        this.clock = clock;
    }

    /** Lève une exception si cet email est actuellement bloqué. */
    public void checkAllowed(String key) {
        Attempts current = attempts.get(key);
        if (current == null || current.lockedUntil() == null) {
            return;
        }
        Instant now = clock.instant();
        if (now.isBefore(current.lockedUntil())) {
            throw new TooManyAttemptsException(Duration.between(now, current.lockedUntil()));
        }
        attempts.remove(key);
    }

    public void onFailure(String key) {
        attempts.compute(key, (k, current) -> {
            int failures = (current == null ? 0 : current.failures()) + 1;
            Instant lockedUntil = failures >= maxAttempts ? clock.instant().plus(lockDuration) : null;
            return new Attempts(failures, lockedUntil);
        });
    }

    public void onSuccess(String key) {
        attempts.remove(key);
    }
}
