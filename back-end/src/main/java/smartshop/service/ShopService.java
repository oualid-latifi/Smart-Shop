package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Shop;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.ShopRepository;
import smartshop.tenancy.TenantContext;

import java.text.Normalizer;
import java.util.UUID;

/** Boutiques (magasins) : création à l'inscription d'un propriétaire, adresse de la boutique en ligne. */
@Service
public class ShopService {

    public record ShopInfo(UUID id, String name, String slug) {
        static ShopInfo from(Shop s) {
            return new ShopInfo(s.getId(), s.getName(), s.getSlug());
        }
    }

    private final ShopRepository repository;

    public ShopService(ShopRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public Shop create(String name) {
        Shop shop = new Shop();
        shop.setName(name.trim());
        shop.setSlug(uniqueSlug(name));
        return repository.save(shop);
    }

    /** Boutique du compte connecté. */
    @Transactional(readOnly = true)
    public ShopInfo current() {
        return ShopInfo.from(find(TenantContext.require()));
    }

    @Transactional(readOnly = true)
    public Shop find(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Boutique introuvable"));
    }

    /** "Phone Nour Casa" -> "phone-nour-casa", puis "-2", "-3"… si l'adresse est déjà prise. */
    String uniqueSlug(String name) {
        String base = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.length() > 50) base = base.substring(0, 50).replaceAll("-$", "");
        if (base.isBlank()) base = "boutique";
        String slug = base;
        for (int i = 2; repository.existsBySlug(slug); i++) slug = base + "-" + i;
        return slug;
    }
}
