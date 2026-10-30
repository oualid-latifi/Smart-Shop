package smartshop.dto;

import smartshop.entity.AppUser;

import java.util.UUID;

public record UserResponse(UUID id, String name, String email) {

    public static UserResponse from(AppUser u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail());
    }
}