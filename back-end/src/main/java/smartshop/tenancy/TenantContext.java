package smartshop.tenancy;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Boutique (tenant) de la requête ou de la tâche en cours.
 * Fixée par JwtAuthenticationFilter (compte connecté), PublicShopFilter (boutique en ligne publique)
 * ou par les tâches planifiées (une boutique après l'autre). Sans boutique : mode "root",
 * réservé à la connexion, à la page de vérification des factures et aux tâches système.
 */
public final class TenantContext {

    /** Valeur technique du mode root (aucun filtrage par boutique). */
    public static final UUID ROOT = new UUID(0L, 0L);

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static Optional<UUID> current() {
        return Optional.ofNullable(CURRENT.get());
    }

    /** Boutique en cours, obligatoire (erreur si on est en mode root). */
    public static UUID require() {
        UUID id = CURRENT.get();
        if (id == null) throw new IllegalStateException("Aucune boutique sélectionnée");
        return id;
    }

    public static void set(UUID shopId) {
        if (shopId == null) CURRENT.remove();
        else CURRENT.set(shopId);
    }

    public static void clear() {
        CURRENT.remove();
    }

    /** Exécute une tâche pour une boutique donnée, puis revient au contexte précédent. */
    public static <T> T runAs(UUID shopId, Supplier<T> task) {
        UUID previous = CURRENT.get();
        set(shopId);
        try {
            return task.get();
        } finally {
            set(previous);
        }
    }

    public static void runAs(UUID shopId, Runnable task) {
        runAs(shopId, () -> {
            task.run();
            return null;
        });
    }
}
