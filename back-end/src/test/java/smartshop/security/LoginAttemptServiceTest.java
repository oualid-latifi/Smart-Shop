package smartshop.security;

import org.junit.jupiter.api.Test;
import smartshop.exception.TooManyAttemptsException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginAttemptServiceTest {

    private static final String EMAIL = "owner@shop.test";

    /** Horloge réglable à la main pour simuler le temps qui passe. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-01-01T10:00:00Z");

        void advance(Duration duration) { now = now.plus(duration); }
        @Override public Instant instant() { return now; }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginAttemptService service = new LoginAttemptService(3, Duration.ofMinutes(15), clock);

    @Test
    void blocksAfterMaxFailures() {
        service.onFailure(EMAIL);
        service.onFailure(EMAIL);
        assertThatCode(() -> service.checkAllowed(EMAIL)).doesNotThrowAnyException();

        service.onFailure(EMAIL);
        assertThatThrownBy(() -> service.checkAllowed(EMAIL)).isInstanceOf(TooManyAttemptsException.class);
    }

    @Test
    void unlocksAfterLockDuration() {
        for (int i = 0; i < 3; i++) service.onFailure(EMAIL);

        clock.advance(Duration.ofMinutes(16));
        assertThatCode(() -> service.checkAllowed(EMAIL)).doesNotThrowAnyException();
    }

    @Test
    void successResetsCounter() {
        service.onFailure(EMAIL);
        service.onFailure(EMAIL);
        service.onSuccess(EMAIL);
        service.onFailure(EMAIL);
        assertThatCode(() -> service.checkAllowed(EMAIL)).doesNotThrowAnyException();
    }
}
