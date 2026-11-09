package smartshop.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;
import smartshop.entity.ActivityLog;
import smartshop.repository.ActivityLogRepository;
import smartshop.security.CurrentUser;

import java.util.Map;
import java.util.UUID;

/**
 * Enregistre dans le journal chaque action réussie qui modifie des données (POST, PUT, DELETE),
 * avec l'employé connecté et un libellé lisible.
 */
@Component
public class ActivityLogInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ActivityLogInterceptor.class);

    // Clé = "MÉTHODE motif-de-l'URL"
    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("POST /api/sales", "Vente enregistrée"),
            Map.entry("POST /api/sales/{id}/cancel", "Vente annulée"),
            Map.entry("POST /api/sales/{id}/returns", "Retour client"),
            Map.entry("POST /api/sales/{id}/invoice", "Facture émise"),
            Map.entry("POST /api/sales/{id}/delivery-note", "Bon de livraison émis"),
            Map.entry("POST /api/quotes", "Devis créé"),
            Map.entry("PUT /api/quotes/{id}/status", "Statut de devis modifié"),
            Map.entry("POST /api/quotes/{id}/convert", "Devis transformé en vente"),
            Map.entry("POST /api/customers", "Client créé"),
            Map.entry("PUT /api/customers/{id}", "Client modifié"),
            Map.entry("DELETE /api/customers/{id}", "Client désactivé"),
            Map.entry("POST /api/customers/{id}/payments", "Encaissement client"),
            Map.entry("POST /api/checks/{operationId}/cashed", "Chèque encaissé"),
            Map.entry("POST /api/checks/{operationId}/bounced", "Chèque impayé"),
            Map.entry("POST /api/products", "Produit créé"),
            Map.entry("PUT /api/products/{id}", "Produit modifié"),
            Map.entry("DELETE /api/products/{id}", "Produit désactivé"),
            Map.entry("POST /api/stock/adjustments", "Ajustement de stock"),
            Map.entry("POST /api/inventories", "Inventaire ouvert"),
            Map.entry("POST /api/inventories/{id}/close", "Inventaire clôturé"),
            Map.entry("POST /api/warehouses/transfers", "Transfert de stock"),
            Map.entry("POST /api/purchases", "Achat enregistré"),
            Map.entry("POST /api/purchases/{id}/payments", "Paiement fournisseur"),
            Map.entry("POST /api/purchases/{id}/returns", "Retour fournisseur"),
            Map.entry("POST /api/purchase-orders", "Bon de commande créé"),
            Map.entry("POST /api/purchase-orders/{id}/receive", "Réception de marchandise"),
            Map.entry("POST /api/expenses", "Dépense ajoutée"),
            Map.entry("PUT /api/expenses/{id}", "Dépense modifiée"),
            Map.entry("DELETE /api/expenses/{id}", "Dépense supprimée"),
            Map.entry("POST /api/cash/handins", "Remise de caisse"),
            Map.entry("POST /api/users", "Compte créé"),
            Map.entry("PUT /api/users/{id}", "Compte modifié"),
            Map.entry("POST /api/users/{id}/password", "Mot de passe réinitialisé"),
            Map.entry("PUT /api/settings", "Paramètres modifiés"),
            Map.entry("PUT /api/targets", "Objectif modifié"),
            Map.entry("POST /api/import/products", "Import de produits"),
            Map.entry("POST /api/import/customers", "Import de clients"),
            Map.entry("POST /api/auth/change-password", "Mot de passe changé"));

    private final ActivityLogRepository repository;

    public ActivityLogInterceptor(ActivityLogRepository repository) {
        this.repository = repository;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        String method = request.getMethod();
        if ("GET".equals(method) || "OPTIONS".equals(method) || "HEAD".equals(method)) return;
        if (response.getStatus() >= 400 || ex != null) return;

        var user = CurrentUser.get();
        if (user.isEmpty()) return; // connexion / création du compte : pas encore d'utilisateur

        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String path = pattern != null ? pattern.toString() : request.getRequestURI();
        String key = method + " " + path;

        try {
            ActivityLog entry = new ActivityLog();
            entry.setUserId(user.get().getId());
            entry.setUserName(user.get().getName());
            entry.setAction(LABELS.getOrDefault(key, key.length() > 120 ? key.substring(0, 120) : key));
            entry.setMethod(method);
            entry.setPath(request.getRequestURI().length() > 255 ? request.getRequestURI().substring(0, 255) : request.getRequestURI());
            entry.setTargetId(targetId(request));
            repository.save(entry);
        } catch (RuntimeException e) {
            // Le journal ne doit jamais faire échouer une opération déjà réussie
            log.warn("Journal d'activité non enregistré : {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private UUID targetId(HttpServletRequest request) {
        Object vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (vars instanceof Map<?, ?> map) {
            for (String name : new String[]{"id", "operationId"}) {
                Object value = ((Map<String, String>) map).get(name);
                if (value != null) {
                    try {
                        return UUID.fromString(value.toString());
                    } catch (IllegalArgumentException ignored) {
                        return null;
                    }
                }
            }
        }
        return null;
    }
}
