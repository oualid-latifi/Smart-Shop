package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.AppUser;
import smartshop.entity.CashHandin;
import smartshop.entity.Permission;
import smartshop.entity.SalesTarget;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.AppUserRepository;
import smartshop.repository.CashHandinRepository;
import smartshop.repository.SalesTargetRepository;
import smartshop.security.CurrentUser;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Caisse des employés (espèces encaissées / remises) et objectifs de vente. */
@Service
public class TeamService {

    public record CashBalance(UUID userId, String name, String role, BigDecimal collected, BigDecimal handedIn, BigDecimal balance) {
    }

    public record HandinResponse(UUID id, UUID employeeId, String employeeName, BigDecimal amount, String receivedBy, String note, LocalDateTime at) {
        static HandinResponse from(CashHandin h) {
            return new HandinResponse(h.getId(), h.getEmployee().getId(), h.getEmployee().getName(), h.getAmount(), h.getReceivedBy(), h.getNote(), h.getAt());
        }
    }

    public record TargetProgress(UUID userId, String name, String month, BigDecimal target, BigDecimal achieved,
                                 long salesCount, Integer percent) {
    }

    private final AppUserRepository userRepository;
    private final CashHandinRepository handinRepository;
    private final SalesTargetRepository targetRepository;

    public TeamService(AppUserRepository userRepository, CashHandinRepository handinRepository, SalesTargetRepository targetRepository) {
        this.userRepository = userRepository;
        this.handinRepository = handinRepository;
        this.targetRepository = targetRepository;
    }

    // ---------------------------------------------------------------- Caisse

    /** Ce que chaque employé a encaissé en espèces et doit encore remettre. */
    @Transactional(readOnly = true)
    public List<CashBalance> balances() {
        return userRepository.findAll().stream()
                .filter(u -> u.isActive() && u.getRole().has(Permission.SALES))
                .map(u -> {
                    BigDecimal collected = handinRepository.sumCashCollected(u.getId()).add(handinRepository.sumWalkInCash(u.getId()));
                    BigDecimal handed = handinRepository.sumByEmployee(u.getId());
                    return new CashBalance(u.getId(), u.getName(), u.getRole().name(), collected, handed, collected.subtract(handed));
                })
                .toList();
    }

    @Transactional
    public HandinResponse handin(UUID employeeId, BigDecimal amount, String note) {
        AppUser employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Compte introuvable"));
        CashHandin h = new CashHandin();
        h.setEmployee(employee);
        h.setAmount(amount);
        h.setNote(note != null && !note.isBlank() ? note.trim() : null);
        h.setReceivedBy(CurrentUser.get().map(AppUser::getName).orElse(null));
        return HandinResponse.from(handinRepository.save(h));
    }

    @Transactional(readOnly = true)
    public List<HandinResponse> handins() {
        return handinRepository.findTop100ByOrderByAtDesc().stream().map(HandinResponse::from).toList();
    }

    // ---------------------------------------------------------------- Objectifs

    @Transactional(readOnly = true)
    public List<TargetProgress> targets(String month) {
        YearMonth ym = month != null ? YearMonth.parse(month) : YearMonth.now();
        LocalDateTime start = ym.atDay(1).atStartOfDay();
        LocalDateTime end = ym.plusMonths(1).atDay(1).atStartOfDay();
        return userRepository.findAll().stream()
                .filter(u -> u.isActive() && u.getRole().has(Permission.SALES))
                .map(u -> {
                    BigDecimal target = targetRepository.findByUser_IdAndMonth(u.getId(), ym.toString())
                            .map(SalesTarget::getAmount).orElse(null);
                    BigDecimal achieved = targetRepository.sumSalesBySeller(u.getId(), start, end);
                    Integer percent = target != null && target.signum() > 0
                            ? achieved.multiply(BigDecimal.valueOf(100)).divide(target, 0, RoundingMode.DOWN).intValue()
                            : null;
                    return new TargetProgress(u.getId(), u.getName(), ym.toString(), target, achieved,
                            targetRepository.countSalesBySeller(u.getId(), start, end), percent);
                })
                .toList();
    }

    @Transactional
    public TargetProgress setTarget(UUID userId, String month, BigDecimal amount) {
        YearMonth ym = YearMonth.parse(month);
        AppUser user = userRepository.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Compte introuvable"));
        SalesTarget target = targetRepository.findByUser_IdAndMonth(userId, ym.toString()).orElseGet(SalesTarget::new);
        target.setUser(user);
        target.setMonth(ym.toString());
        target.setAmount(amount);
        targetRepository.save(target);
        return targets(ym.toString()).stream().filter(t -> t.userId().equals(userId)).findFirst().orElseThrow();
    }
}
