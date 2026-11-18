package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.ShopSettingsDto;
import smartshop.entity.ShopSettings;
import smartshop.repository.ShopRepository;
import smartshop.repository.ShopSettingsRepository;
import smartshop.tenancy.TenantContext;

import java.util.UUID;

/** Paramètres de la boutique en cours (une ligne par boutique, filtrée automatiquement). */
@Service
public class ShopSettingsService {

    private final ShopSettingsRepository repository;
    private final ShopRepository shopRepository;

    public ShopSettingsService(ShopSettingsRepository repository, ShopRepository shopRepository) {
        this.repository = repository;
        this.shopRepository = shopRepository;
    }

    /** Renvoie les paramètres, ou des valeurs par défaut s'ils n'ont jamais été enregistrés. */
    @Transactional(readOnly = true)
    public ShopSettings get() {
        return repository.findAll().stream().findFirst().orElseGet(this::defaults);
    }

    /** Paramètres d'une boutique précise, en mode root (page publique de vérification des factures). */
    @Transactional(readOnly = true)
    public ShopSettings forShop(UUID shopId) {
        return repository.findByShopId(shopId).orElseGet(ShopSettings::new);
    }

    @Transactional
    public ShopSettings update(ShopSettingsDto request) {
        ShopSettings settings = get();
        request.applyTo(settings);
        return repository.save(settings);
    }

    private ShopSettings defaults() {
        ShopSettings settings = new ShopSettings();
        TenantContext.current().ifPresent(shopId -> {
            // Identifiant stable dérivé de la boutique (la boutique d'avant le multi-boutiques garde l'id 1)
            settings.setId(shopId.getMostSignificantBits() & Long.MAX_VALUE | 2L);
            shopRepository.findById(shopId).ifPresent(shop -> settings.setShopName(shop.getName()));
        });
        return settings;
    }
}
