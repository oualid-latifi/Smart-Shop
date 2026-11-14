package smartshop.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import smartshop.entity.AppUser;
import smartshop.entity.CheckStatus;
import smartshop.entity.Notification;
import smartshop.entity.Permission;
import smartshop.entity.Product;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.AppUserRepository;
import smartshop.repository.CustomerPaymentRepository;
import smartshop.repository.NotificationRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Crée les notifications de la boutique et les envoie en push (Expo) aux téléphones enregistrés.
 * Le push est facultatif : sans jeton enregistré, les notifications restent visibles dans l'application.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    public record NotificationResponse(UUID id, Notification.Type type, String title, String body, UUID referenceId,
                                       java.time.LocalDateTime createdAt, boolean read) {
    }

    public record Feed(long unread, List<NotificationResponse> items) {
    }

    private final NotificationRepository repository;
    private final AppUserRepository userRepository;
    private final CustomerPaymentRepository paymentRepository;
    private final NotificationWriter writer;
    private final RestClient http = RestClient.create();

    public NotificationService(NotificationRepository repository, AppUserRepository userRepository,
                               CustomerPaymentRepository paymentRepository, NotificationWriter writer) {
        this.repository = repository;
        this.writer = writer;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
    }

    /**
     * Enregistre une notification (une seule fois par dedupeKey) puis l'envoie en push.
     * L'écriture se fait dans sa propre transaction (NotificationWriter) : une notification ratée
     * n'annule jamais la vente qui l'a déclenchée.
     */
    public void notify(Notification.Type type, String title, String body, Permission audience, UUID referenceId, String dedupeKey) {
        try {
            Notification n = writer.write(type, title, body, audience, referenceId, dedupeKey);
            if (n != null) push(n);
        } catch (RuntimeException e) {
            log.warn("Notification non enregistrée : {}", e.getMessage());
        }
    }

    public void lowStock(Product p) {
        notify(Notification.Type.LOW_STOCK, "Stock bas : " + p.getName(),
                p.getStockQuantity() <= 0 ? "Rupture de stock" : "Il reste " + p.getStockQuantity() + " (seuil " + p.getAlertThreshold() + ")",
                Permission.STOCK, p.getId(), "low-stock:" + p.getId() + ":" + LocalDate.now());
    }

    @Transactional(readOnly = true)
    public Feed feed(AppUser user) {
        List<Notification> items = repository.findVisible(user.getRole().getPermissions(), PageRequest.of(0, 50));
        long unread = items.stream().filter(n -> !n.getReadBy().contains(user.getId())).count();
        return new Feed(unread, items.stream().map(n -> new NotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.getReferenceId(), n.getCreatedAt(), n.getReadBy().contains(user.getId()))).toList());
    }

    @Transactional
    public void markRead(AppUser user, UUID id) {
        Notification n = repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Notification introuvable"));
        n.getReadBy().add(user.getId());
        repository.save(n);
    }

    @Transactional
    public void markAllRead(AppUser user) {
        for (Notification n : repository.findVisible(user.getRole().getPermissions(), PageRequest.of(0, 200))) {
            if (n.getReadBy().add(user.getId())) repository.save(n);
        }
    }

    @Transactional
    public void registerPushToken(AppUser user, String token) {
        AppUser fresh = userRepository.findById(user.getId()).orElseThrow();
        fresh.setPushToken(token == null || token.isBlank() ? null : token.trim());
        userRepository.save(fresh);
    }

    /** Chaque matin : rappel des chèques à encaisser aujourd'hui ou dans les 2 jours. */
    @Scheduled(cron = "${app.notifications.checks-cron:0 0 8 * * *}")
    @Transactional(readOnly = true)
    public void checksDueSoon() {
        LocalDate today = LocalDate.now();
        paymentRepository.findChecks(CheckStatus.PENDING).stream()
                .filter(p -> p.getCheckDueDate() != null && !p.getCheckDueDate().isAfter(today.plusDays(2)))
                .forEach(p -> notify(Notification.Type.CHECK_DUE, "Chèque à encaisser : " + p.getCustomer().getName(),
                        "Chèque n° " + p.getCheckNumber() + " de " + DocumentPdfService.money(p.getAmount()) + " DH, échéance le "
                                + p.getCheckDueDate().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                        Permission.PAYMENTS, p.getOperationId() != null ? p.getOperationId() : p.getId(),
                        "check-due:" + (p.getOperationId() != null ? p.getOperationId() : p.getId()) + ":" + today));
    }

    /** Envoi push Expo aux comptes actifs qui ont le droit de voir la notification. */
    private void push(Notification n) {
        List<Map<String, Object>> messages = new ArrayList<>();
        for (AppUser u : userRepository.findAll()) {
            if (!u.isActive() || u.getPushToken() == null) continue;
            if (n.getAudience() != null && !u.getRole().has(n.getAudience())) continue;
            messages.add(Map.of("to", u.getPushToken(), "title", n.getTitle(), "body", n.getBody(), "sound", "default",
                    "data", Map.of("type", n.getType().name(), "id", n.getId().toString())));
        }
        if (messages.isEmpty()) return;
        // En arrière-plan : la requête de l'utilisateur n'attend pas le service de push
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                http.post().uri(EXPO_PUSH_URL).contentType(MediaType.APPLICATION_JSON).body(messages).retrieve().toBodilessEntity();
            } catch (RuntimeException e) {
                log.warn("Push Expo non envoyé : {}", e.getMessage());
            }
        });
    }
}
