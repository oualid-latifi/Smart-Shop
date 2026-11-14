package smartshop.service;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Product;
import smartshop.entity.Promotion;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.ProductRepository;
import smartshop.repository.PromotionRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PromotionService {

    public record PromotionRequest(@NotBlank @Size(max = 100) String name, @NotNull Promotion.Kind kind,
                                   @NotNull @DecimalMin("0.01") BigDecimal value, UUID productId,
                                   @Size(max = 80) String brand, @NotNull LocalDate startsOn, @NotNull LocalDate endsOn,
                                   Boolean active) {
    }

    public record PromotionResponse(UUID id, String name, Promotion.Kind kind, BigDecimal value, UUID productId,
                                    String productName, String brand, LocalDate startsOn, LocalDate endsOn,
                                    boolean active, boolean running) {
        static PromotionResponse from(Promotion p) {
            return new PromotionResponse(p.getId(), p.getName(), p.getKind(), p.getValue(),
                    p.getProduct() != null ? p.getProduct().getId() : null,
                    p.getProduct() != null ? p.getProduct().getName() : null,
                    p.getBrand(), p.getStartsOn(), p.getEndsOn(), Boolean.TRUE.equals(p.getActive()), p.isRunning(LocalDate.now()));
        }
    }

    /** Promotion applicable à un produit : prix unitaire promo (null pour "2e article") et libellé. */
    public record Offer(BigDecimal unitPrice, BigDecimal secondItemPercent, String label) {
    }

    private final PromotionRepository repository;
    private final ProductRepository productRepository;

    public PromotionService(PromotionRepository repository, ProductRepository productRepository) {
        this.repository = repository;
        this.productRepository = productRepository;
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> findAll() {
        return repository.findAllByOrderByStartsOnDesc().stream().map(PromotionResponse::from).toList();
    }

    @Transactional
    public PromotionResponse save(UUID id, PromotionRequest request) {
        if (request.endsOn().isBefore(request.startsOn())) {
            throw new IllegalArgumentException("La date de fin doit être après la date de début");
        }
        if (request.kind() != Promotion.Kind.FIXED_PRICE && request.value().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("Le pourcentage doit être entre 0 et 100");
        }
        if (request.kind() == Promotion.Kind.FIXED_PRICE && request.productId() == null) {
            throw new IllegalArgumentException("Un prix promotionnel fixe concerne un seul produit");
        }
        Promotion p = id == null ? new Promotion() : repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promotion introuvable"));
        p.setName(request.name().trim());
        p.setKind(request.kind());
        p.setValue(request.value());
        p.setProduct(request.productId() != null ? productRepository.findById(request.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable")) : null);
        p.setBrand(request.productId() == null && request.brand() != null && !request.brand().isBlank() ? request.brand().trim() : null);
        p.setStartsOn(request.startsOn());
        p.setEndsOn(request.endsOn());
        p.setActive(request.active() == null || request.active());
        return PromotionResponse.from(repository.save(p));
    }

    @Transactional
    public void delete(UUID id) {
        repository.deleteById(id);
    }

    /** Promotions en cours aujourd'hui (à charger une fois pour une liste de produits). */
    @Transactional(readOnly = true)
    public List<Promotion> running() {
        return repository.findRunning(LocalDateTime.now().toLocalDate());
    }

    /** Meilleure offre pour ce produit parmi les promotions en cours (prix le plus bas). */
    public Offer bestOffer(Product product, List<Promotion> running) {
        Offer best = null;
        for (Promotion promo : running) {
            if (!promo.appliesTo(product)) continue;
            Offer offer = switch (promo.getKind()) {
                case PERCENT_OFF -> new Offer(percentOff(product.getSalePrice(), promo.getValue()), null,
                        promo.getName() + " -" + promo.getValue().stripTrailingZeros().toPlainString() + " %");
                case FIXED_PRICE -> new Offer(promo.getValue().min(product.getSalePrice()), null, promo.getName());
                case SECOND_ITEM_PERCENT -> new Offer(null, promo.getValue(),
                        promo.getName() + " : 2e à -" + promo.getValue().stripTrailingZeros().toPlainString() + " %");
            };
            if (best == null || price(offer, product).compareTo(price(best, product)) < 0) best = offer;
        }
        return best;
    }

    /**
     * Prix unitaire moyen d'une ligne de q articles avec cette offre.
     * Exemple "2e à -50 %" sur 3 articles à 100 DH : (300 - 50) / 3 = 83,33 DH.
     */
    public static BigDecimal lineUnitPrice(Product product, Offer offer, int quantity) {
        if (offer == null) return product.getSalePrice();
        if (offer.unitPrice() != null) return offer.unitPrice();
        BigDecimal price = product.getSalePrice();
        int discounted = quantity / 2;
        BigDecimal total = price.multiply(BigDecimal.valueOf(quantity))
                .subtract(price.multiply(offer.secondItemPercent()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(discounted)));
        return total.divide(BigDecimal.valueOf(quantity), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal price(Offer offer, Product product) {
        // Pour comparer, "2e article" vaut son prix moyen sur 2 articles
        return offer.unitPrice() != null ? offer.unitPrice() : lineUnitPrice(product, offer, 2);
    }

    private static BigDecimal percentOff(BigDecimal price, BigDecimal percent) {
        return price.subtract(price.multiply(percent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    }
}
