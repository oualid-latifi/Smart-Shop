package smartshop.dto;

import java.time.Instant;

public record AuthResponse(
        String token,
        Instant expiresAt,
        String name,
        String email
) {
}