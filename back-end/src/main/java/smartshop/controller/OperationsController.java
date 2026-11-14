package smartshop.controller;

import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import smartshop.entity.AppUser;
import smartshop.entity.Role;
import smartshop.service.ApprovalService;
import smartshop.service.BackupService;
import smartshop.service.NotificationService;
import smartshop.service.WeeklyReportService;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Sauvegardes, rapport hebdomadaire et notifications. */
@RestController
public class OperationsController {

    public record PushTokenRequest(@Size(max = 255) String token) {
    }

    private final BackupService backupService;
    private final WeeklyReportService weeklyReportService;
    private final NotificationService notificationService;
    private final ApprovalService approvalService;

    public OperationsController(BackupService backupService, WeeklyReportService weeklyReportService,
                                NotificationService notificationService, ApprovalService approvalService) {
        this.backupService = backupService;
        this.weeklyReportService = weeklyReportService;
        this.notificationService = notificationService;
        this.approvalService = approvalService;
    }

    // ---------------------------------------------------------------- Sauvegardes (propriétaire)

    @GetMapping("/api/backups")
    public List<BackupService.BackupInfo> backups(@AuthenticationPrincipal AppUser user) throws IOException {
        requireOwner(user);
        return backupService.list();
    }

    @PostMapping("/api/backups")
    public BackupService.BackupInfo createBackup(@AuthenticationPrincipal AppUser user) throws IOException {
        requireOwner(user);
        return backupService.create();
    }

    @GetMapping("/api/backups/{name}")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal AppUser user, @PathVariable String name) throws IOException {
        requireOwner(user);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(backupService.read(name));
    }

    /** Restaure une sauvegarde du serveur (par nom) : code PIN du propriétaire exigé s'il est défini. */
    @PostMapping("/api/backups/{name}/restore")
    public Map<String, Integer> restore(@AuthenticationPrincipal AppUser user, @PathVariable String name,
                                        @RequestParam(required = false) String pin) throws IOException {
        requireOwner(user);
        approvalService.checkRestore(pin);
        return backupService.restore(backupService.read(name));
    }

    /** Restaure un fichier de sauvegarde envoyé depuis le téléphone. */
    @PostMapping(value = "/api/backups/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Integer> restoreUpload(@AuthenticationPrincipal AppUser user, @RequestParam("file") MultipartFile file,
                                              @RequestParam(required = false) String pin) throws IOException {
        requireOwner(user);
        approvalService.checkRestore(pin);
        return backupService.restore(file.getBytes());
    }

    // ---------------------------------------------------------------- Rapport hebdomadaire

    @GetMapping("/api/reports/weekly")
    public WeeklyReportService.Weekly weekly() {
        return weeklyReportService.lastWeek();
    }

    @PostMapping("/api/reports/weekly/send")
    public Map<String, Integer> sendWeekly() throws Exception {
        return Map.of("recipients", weeklyReportService.send(weeklyReportService.lastWeek()));
    }

    // ---------------------------------------------------------------- Notifications

    @GetMapping("/api/notifications")
    public NotificationService.Feed notifications(@AuthenticationPrincipal AppUser user) {
        return notificationService.feed(user);
    }

    @PostMapping("/api/notifications/{id}/read")
    public void read(@AuthenticationPrincipal AppUser user, @PathVariable UUID id) {
        notificationService.markRead(user, id);
    }

    @PostMapping("/api/notifications/read-all")
    public void readAll(@AuthenticationPrincipal AppUser user) {
        notificationService.markAllRead(user);
    }

    @PutMapping("/api/notifications/push-token")
    public void pushToken(@AuthenticationPrincipal AppUser user, @RequestBody PushTokenRequest request) {
        notificationService.registerPushToken(user, request.token());
    }

    private static void requireOwner(AppUser user) {
        if (user.getRole() != Role.OWNER) {
            throw new org.springframework.security.access.AccessDeniedException("Réservé au propriétaire");
        }
    }
}
