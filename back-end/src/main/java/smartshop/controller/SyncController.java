package smartshop.controller;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import smartshop.entity.AppUser;
import smartshop.service.SyncService;

import java.time.LocalDateTime;
import java.util.List;

/** Synchronisation de la base locale (SQLite) du téléphone avec le serveur. */
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    public record PushRequest(@NotNull @Size(max = 100) List<SyncService.Operation> operations) {
    }

    public record PushResponse(List<SyncService.OperationResult> results) {
    }

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    /** Changements depuis "since" (curseur renvoyé par l'appel précédent ; absent = tout). */
    @GetMapping("/pull")
    public SyncService.PullResponse pull(@AuthenticationPrincipal AppUser user,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since,
                                         @RequestParam(required = false) String promoKey) {
        return syncService.pull(user, since, promoKey);
    }

    /** Opérations faites hors-ligne, dans l'ordre où elles ont été faites. */
    @PostMapping("/push")
    public PushResponse push(@AuthenticationPrincipal AppUser user, @Valid @RequestBody PushRequest request) {
        return new PushResponse(syncService.push(user, request.operations()));
    }
}
