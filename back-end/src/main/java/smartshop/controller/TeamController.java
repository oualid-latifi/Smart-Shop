package smartshop.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.service.TeamService;
import smartshop.service.TeamService.CashBalance;
import smartshop.service.TeamService.HandinResponse;
import smartshop.service.TeamService.TargetProgress;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class TeamController {

    public record HandinRequest(@NotNull UUID employeeId, @NotNull @DecimalMin("0.01") BigDecimal amount, @Size(max = 255) String note) {
    }

    public record TargetRequest(@NotNull UUID userId,
                                @NotNull @Pattern(regexp = "^\\d{4}-\\d{2}$", message = "Format attendu : AAAA-MM") String month,
                                @NotNull @DecimalMin("0.00") BigDecimal amount) {
    }

    private final TeamService teamService;

    public TeamController(TeamService teamService) {
        this.teamService = teamService;
    }

    @GetMapping("/cash/balances")
    public List<CashBalance> balances() {
        return teamService.balances();
    }

    @GetMapping("/cash/handins")
    public List<HandinResponse> handins() {
        return teamService.handins();
    }

    @PostMapping("/cash/handins")
    @ResponseStatus(HttpStatus.CREATED)
    public HandinResponse handin(@Valid @RequestBody HandinRequest request) {
        return teamService.handin(request.employeeId(), request.amount(), request.note());
    }

    // ?month=2026-11 (mois en cours par défaut). Visible par tous : chaque vendeur suit l'équipe.
    @GetMapping("/targets")
    public List<TargetProgress> targets(@RequestParam(required = false) String month) {
        return teamService.targets(month);
    }

    @PutMapping("/targets")
    public TargetProgress setTarget(@Valid @RequestBody TargetRequest request) {
        return teamService.setTarget(request.userId(), request.month(), request.amount());
    }
}
