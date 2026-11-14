package smartshop.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Notification;
import smartshop.entity.Permission;
import smartshop.repository.NotificationRepository;

import java.util.UUID;

/**
 * Écrit une notification dans sa propre transaction : un échec ici (doublon, base occupée…)
 * n'annule jamais l'opération qui l'a déclenchée (une vente, par exemple).
 */
@Component
public class NotificationWriter {

    private final NotificationRepository repository;

    public NotificationWriter(NotificationRepository repository) {
        this.repository = repository;
    }

    /** Renvoie la notification créée, ou null si elle existait déjà (même dedupeKey). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Notification write(Notification.Type type, String title, String body, Permission audience, UUID referenceId, String dedupeKey) {
        if (dedupeKey != null && repository.existsByDedupeKey(dedupeKey)) return null;
        Notification n = new Notification();
        n.setType(type);
        n.setTitle(truncate(title, 120));
        n.setBody(truncate(body, 255));
        n.setAudience(audience);
        n.setReferenceId(referenceId);
        n.setDedupeKey(dedupeKey);
        return repository.save(n);
    }

    private static String truncate(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
