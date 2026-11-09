package smartshop.dto;

import smartshop.entity.AppUser;

import java.util.UUID;

public record UserResponse(UUID id, String name, String email, smartshop.entity.Role role, boolean active,
                           java.util.Set<smartshop.entity.Permission> permissions) {

    public static UserResponse from(AppUser u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.isActive(), u.getRole().getPermissions());
    }
}