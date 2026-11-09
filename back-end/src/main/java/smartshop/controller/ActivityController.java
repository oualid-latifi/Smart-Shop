package smartshop.controller;

import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import smartshop.entity.ActivityLog;
import smartshop.repository.ActivityLogRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    public record ActivityResponse(UUID id, UUID userId, String userName, String action, String path, UUID targetId, LocalDateTime at) {
        static ActivityResponse from(ActivityLog a) {
            return new ActivityResponse(a.getId(), a.getUserId(), a.getUserName(), a.getAction(), a.getPath(), a.getTargetId(), a.getAt());
        }
    }

    private final ActivityLogRepository repository;

    public ActivityController(ActivityLogRepository repository) {
        this.repository = repository;
    }

    // Sans dates : les 7 derniers jours
    @GetMapping
    public List<ActivityResponse> search(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "200") int limit) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(6);
        return repository.search(userId, start.atStartOfDay(), end.plusDays(1).atStartOfDay(),
                        PageRequest.of(0, Math.min(Math.max(limit, 1), 1000)))
                .stream().map(ActivityResponse::from).toList();
    }
}
