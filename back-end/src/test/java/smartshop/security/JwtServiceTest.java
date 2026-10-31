package smartshop.security;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import smartshop.entity.AppUser;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "test-secret-for-jwt-signing-at-least-32-bytes-long";

    @Test
    void issueCreatesTokenWithUserIdentityAndVersion() {
        JwtService service = new JwtService(SECRET, 15);
        AppUser user = new AppUser();
        UUID userId = UUID.randomUUID();
        ReflectionTestUtils.setField(user, "id", userId);
        user.setTokenVersion(3);

        JwtService.IssuedToken issued = service.issue(user);

        Claims claims = service.parse(issued.token()).orElseThrow();
        assertEquals(userId.toString(), claims.getSubject());
        assertEquals(3, claims.get("ver", Integer.class));
        assertNotNull(claims.getExpiration());
        assertTrue(issued.expiresAt().isAfter(java.time.Instant.now()));
    }

    @Test
    void parseRejectsTokenSignedWithAnotherSecret() {
        JwtService issuer = new JwtService(SECRET, 15);
        JwtService verifier = new JwtService("another-test-secret-at-least-32-bytes-long", 15);
        AppUser user = new AppUser();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());

        String token = issuer.issue(user).token();

        assertTrue(verifier.parse(token).isEmpty());
    }

    @Test
    void constructorRejectsShortSecret() {
        assertThrows(IllegalStateException.class, () -> new JwtService("too-short", 15));
    }

    @Test
    void parseRejectsMalformedToken() {
        JwtService service = new JwtService(SECRET, 15);

        assertTrue(service.parse("not-a-jwt").isEmpty());
    }
}
