package smartshop.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.Role;

public final class UserRequests {

    private UserRequests() {
    }

    public record CreateUser(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(min = 8, max = 100) String password,
            @NotNull Role role) {
    }

    public record UpdateUser(
            @NotBlank @Size(max = 100) String name,
            @NotNull Role role,
            @NotNull Boolean active) {
    }

    public record ResetPassword(@NotBlank @Size(min = 8, max = 100) String password) {
    }
}
