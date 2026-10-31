package smartshop.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.StockMovementResponse;
import smartshop.entity.Product;
import smartshop.entity.StockMovement;
import smartshop.entity.StockMovementType;
import smartshop.repository.ProductRepository;
import smartshop.repository.StockMovementRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class StockService {

    private static final LocalDateTime MIN_DATE = LocalDateTime.of(2000, 1, 1, 0, 0);
    private static final LocalDateTime MAX_DATE = LocalDateTime.of(2999, 12, 31, 0, 0);
    private static final int MAX_LIMIT = 500;

    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;

    public StockService(ProductRepository productRepository,
                        StockMovementRepository stockMovementRepository) {
        this.productRepository = productRepository;
        this.stockMovementRepository = stockMovementRepository;
    }

    /**
     * Historique du stock. Tous les filtres sont facultatifs.
     * Sans dates : tout l'historique (limité par "limit", 500 au maximum).
     */
    @Transactional(readOnly = true)
    public List<StockMovementResponse> findMovements(UUID productId, LocalDate from, LocalDate to, int limit) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("La date de début doit être avant la date de fin");
        }
        LocalDateTime start = from != null ? from.atStartOfDay() : MIN_DATE;
        LocalDateTime end = to != null ? to.plusDays(1).atStartOfDay() : MAX_DATE;
        Pageable page = PageRequest.of(0, Math.min(Math.max(limit, 1), MAX_LIMIT));

        List<StockMovement> movements;
        if (productId != null) {
            if (!productRepository.existsById(productId)) {
                throw new IllegalArgumentException("Produit introuvable");
            }
            movements = stockMovementRepository
                    .findByProductIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                            productId, start, end, page);
        } else {
            movements = stockMovementRepository
                    .findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end, page);
        }
        return movements.stream().map(StockMovementResponse::from).toList();
    }

    /**
     * Inventaire : on donne la quantité comptée, l'application calcule l'écart
     * et l'enregistre dans l'historique. Le prix d'achat moyen ne change pas.
     */
    @Transactional
    public Product adjust(UUID productId, int countedQuantity, String note) {
        Product product = productRepository.findByIdForUpdate(productId)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));

        int difference = countedQuantity - product.getStockQuantity();
        if (difference == 0) {
            throw new IllegalArgumentException(
                    "Le stock compté est identique au stock actuel : aucun ajustement nécessaire");
        }

        product.setStockQuantity(countedQuantity);
        productRepository.save(product);

        StockMovement movement = new StockMovement();
        movement.setProduct(product);
        movement.setType(StockMovementType.ADJUSTMENT);
        movement.setQuantity(difference);
        movement.setNote(note);
        stockMovementRepository.save(movement);

        return product;
    }
}