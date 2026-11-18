package smartshop.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import smartshop.entity.Role;

/** Compte créé depuis l'écran de connexion : autorisé par l'email et le mot de passe du propriétaire. */
public record EmployeeRegisterRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email @Size(max = 150) String email,
        @NotBlank @Size(min = 8, max = 100) String password,
        @NotNull Role role,
        @NotBlank @Email @Size(max = 150) String ownerEmail,
        @NotBlank @Size(max = 100) String ownerPassword
) {
}
