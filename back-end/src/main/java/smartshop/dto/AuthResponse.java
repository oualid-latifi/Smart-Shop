package smartshop.dto;

import java.time.Instant;

public record AuthResponse(
        String token,
        Instant expiresAt,
        String name,
        String email,
        smartshop.entity.Role role,
        java.util.Set<smartshop.entity.Permission> permissions
) {
}