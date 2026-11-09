package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.ShopSettingsDto;
import smartshop.entity.ShopSettings;
import smartshop.repository.ShopSettingsRepository;

@Service
public class ShopSettingsService {

    private final ShopSettingsRepository repository;

    public ShopSettingsService(ShopSettingsRepository repository) {
        this.repository = repository;
    }

    /** Renvoie les paramètres, ou des valeurs par défaut s'ils n'ont jamais été enregistrés. */
    @Transactional(readOnly = true)
    public ShopSettings get() {
        return repository.findById(ShopSettings.SINGLETON_ID).orElseGet(ShopSettings::new);
    }

    @Transactional
    public ShopSettings update(ShopSettingsDto request) {
        ShopSettings settings = repository.findById(ShopSettings.SINGLETON_ID).orElseGet(ShopSettings::new);
        request.applyTo(settings);
        return repository.save(settings);
    }
}
