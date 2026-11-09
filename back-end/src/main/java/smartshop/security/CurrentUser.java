package smartshop.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import smartshop.entity.AppUser;
import smartshop.entity.Permission;

import java.util.Optional;

/** Accès au compte connecté depuis les services et les DTO. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<AppUser> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AppUser user ? Optional.of(user) : Optional.empty();
    }

    /** Hors requête HTTP (tests, tâches internes) : tous les droits. */
    public static boolean has(Permission permission) {
        return get().map(u -> u.getRole().has(permission)).orElse(true);
    }

    /** Prix d'achat, coûts et bénéfices visibles ? (masqués aux vendeurs et magasiniers) */
    public static boolean canSeeMargins() {
        return has(Permission.MARGINS);
    }
}
