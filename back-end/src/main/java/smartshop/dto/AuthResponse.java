package smartshop.dto;

import java.time.Instant;

public record AuthResponse(
        String token,
        Instant expiresAt,
        String refreshToken,
        Instant refreshExpiresAt,
        String name,
        String email
) {}