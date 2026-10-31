package smartshop.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import smartshop.entity.AppUser;
import smartshop.entity.RefreshSession;
import smartshop.exception.InvalidRefreshTokenException;
import smartshop.repository.RefreshSessionRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshSessionRepository sessions;

    private RefreshTokenService service;
    private AppUser user;
    private UUID familyId;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(sessions, 30);
        user = new AppUser();
        user.setName("Test");
        familyId = UUID.randomUUID();
    }

    @Test
    void rotateRevokesOldSessionAndCreatesTokenInSameFamily() throws Exception {
        String raw = "old-refresh-token";
        RefreshSession old = new RefreshSession(user, hash(raw), familyId, Instant.now().plusSeconds(600));
        when(sessions.findForUpdateByTokenHash(hash(raw))).thenReturn(Optional.of(old));
        when(sessions.save(any(RefreshSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RefreshTokenService.IssuedRefreshToken issued = service.rotate(raw);

        assertNotNull(issued.token());
        assertNotEquals(raw, issued.token());
        assertTrue(old.getRevokedAt() != null);
        ArgumentCaptor<RefreshSession> captor = ArgumentCaptor.forClass(RefreshSession.class);
        verify(sessions).save(captor.capture());
        assertEquals(familyId, captor.getValue().getFamilyId());
        assertEquals(hash(issued.token()), captor.getValue().getTokenHash());
    }

    @Test
    void replayedTokenRevokesItsWholeFamily() throws Exception {
        String raw = "replayed-refresh-token";
        RefreshSession old = new RefreshSession(user, hash(raw), familyId, Instant.now().plusSeconds(600));
        old.revoke();
        when(sessions.findForUpdateByTokenHash(hash(raw))).thenReturn(Optional.of(old));

        assertThrows(InvalidRefreshTokenException.class, () -> service.rotate(raw));

        verify(sessions).revokeFamily(familyId);
        verify(sessions, never()).save(any(RefreshSession.class));
    }

    @Test
    void expiredTokenIsRevokedAndRejected() throws Exception {
        String raw = "expired-refresh-token";
        RefreshSession old = new RefreshSession(user, hash(raw), familyId, Instant.now().minusSeconds(1));
        when(sessions.findForUpdateByTokenHash(hash(raw))).thenReturn(Optional.of(old));

        assertThrows(InvalidRefreshTokenException.class, () -> service.rotate(raw));

        assertNotNull(old.getRevokedAt());
        verify(sessions, never()).save(any(RefreshSession.class));
    }

    @Test
    void blankTokenIsRejectedWithoutDatabaseLookup() {
        assertThrows(InvalidRefreshTokenException.class, () -> service.rotate("  "));
        verifyNoInteractions(sessions);
    }

    private static String hash(String token) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest);
    }
}
