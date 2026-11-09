package smartshop.exception;

import java.time.Duration;

/** Trop de tentatives de connexion échouées : renvoyée en 429. */
public class TooManyAttemptsException extends RuntimeException {

    private final Duration retryAfter;

    public TooManyAttemptsException(Duration retryAfter) {
        super("Trop de tentatives de connexion. Réessaie dans quelques minutes.");
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
