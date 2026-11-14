package smartshop.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Role;
import smartshop.entity.ShopSettings;
import smartshop.exception.ApprovalRequiredException;
import smartshop.repository.ShopSettingsRepository;
import smartshop.security.CurrentUser;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Double validation : au-delà du plafond de remise, ou pour annuler une vente, un employé
 * doit saisir le code PIN du propriétaire. Le propriétaire lui-même n'a jamais besoin du code.
 */
@Service
public class ApprovalService {

    private final ShopSettingsService settingsService;
    private final ShopSettingsRepository settingsRepository;
    private final PasswordEncoder passwordEncoder;

    public ApprovalService(ShopSettingsService settingsService, ShopSettingsRepository settingsRepository, PasswordEncoder passwordEncoder) {
        this.settingsService = settingsService;
        this.settingsRepository = settingsRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /** Remise réelle = écart entre le prix catalogue (promotions comprises) et le total payé. */
    public void checkDiscount(BigDecimal catalogValue, BigDecimal total, String pin) {
        ShopSettings settings = settingsService.get();
        if (settings.getMaxDiscountPercent() == null || isOwner() || catalogValue.signum() <= 0) return;
        BigDecimal percent = catalogValue.subtract(total).multiply(BigDecimal.valueOf(100)).divide(catalogValue, 2, RoundingMode.HALF_UP);
        if (percent.compareTo(BigDecimal.valueOf(settings.getMaxDiscountPercent())) > 0) {
            requirePin(settings, pin, "Remise de " + percent.stripTrailingZeros().toPlainString()
                    + " % : au-delà de " + settings.getMaxDiscountPercent() + " %, le code du propriétaire est nécessaire");
        }
    }

    public void checkCancellation(String pin) {
        ShopSettings settings = settingsService.get();
        if (isOwner() || settings.getApprovalPinHash() == null) return;
        requirePin(settings, pin, "L'annulation d'une vente nécessite le code du propriétaire");
    }

    @Transactional
    public void setPin(String pin) {
        ShopSettings settings = settingsService.get();
        settings.setApprovalPinHash(pin == null || pin.isBlank() ? null : passwordEncoder.encode(pin));
        settingsRepository.save(settings);
    }

    private void requirePin(ShopSettings settings, String pin, String message) {
        if (settings.getApprovalPinHash() == null) {
            throw new ApprovalRequiredException(message + " (aucun code défini : demande au propriétaire de le créer dans Ma boutique)");
        }
        if (pin == null || !passwordEncoder.matches(pin, settings.getApprovalPinHash())) {
            throw new ApprovalRequiredException(pin == null ? message : "Code du propriétaire incorrect");
        }
    }

    private static boolean isOwner() {
        return CurrentUser.get().map(u -> u.getRole() == Role.OWNER).orElse(true);
    }
}
