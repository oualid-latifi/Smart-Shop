package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.InventoryDtos.Count;
import smartshop.dto.InventoryDtos.OpenRequest;
import smartshop.entity.DocumentType;
import smartshop.entity.InventoryCount;
import smartshop.entity.InventoryCountLine;
import smartshop.entity.Product;
import smartshop.entity.StockMovement;
import smartshop.entity.StockMovementType;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.InventoryCountRepository;
import smartshop.repository.ProductRepository;
import smartshop.repository.StockMovementRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class InventoryService {

    private final InventoryCountRepository inventoryRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository movementRepository;
    private final NumberingService numberingService;

    public InventoryService(InventoryCountRepository inventoryRepository,
                            ProductRepository productRepository,
                            StockMovementRepository movementRepository,
                            NumberingService numberingService) {
        this.inventoryRepository = inventoryRepository;
        this.productRepository = productRepository;
        this.movementRepository = movementRepository;
        this.numberingService = numberingService;
    }

    @Transactional
    public InventoryCount open(OpenRequest request) {
        if (inventoryRepository.existsByStatus(InventoryCount.Status.OPEN)) {
            throw new IllegalArgumentException("Un inventaire est déjà en cours : clôture-le ou annule-le d'abord");
        }
        List<Product> products = request.productIds() == null || request.productIds().isEmpty()
                ? productRepository.findByActiveTrue()
                : productRepository.findAllById(request.productIds());
        if (products.isEmpty()) {
            throw new IllegalArgumentException("Aucun produit à inventorier");
        }

        InventoryCount inventory = new InventoryCount();
        inventory.setNumber(numberingService.next(DocumentType.INVENTORY));
        inventory.setNote(request.note() != null && !request.note().isBlank() ? request.note().trim() : null);
        for (Product p : products) {
            InventoryCountLine line = new InventoryCountLine();
            line.setProduct(p);
            line.setProductName(p.getName());
            line.setExpectedQuantity(p.getStockQuantity());
            line.setUnitCost(p.getAveragePurchasePrice());
            inventory.addLine(line);
        }
        return inventoryRepository.save(inventory);
    }

    @Transactional
    public InventoryCount saveCounts(UUID id, List<Count> counts) {
        InventoryCount inventory = findOpen(id);
        for (Count count : counts) {
            InventoryCountLine line = inventory.getLines().stream()
                    .filter(l -> l.getProduct().getId().equals(count.productId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Ce produit ne fait pas partie de l'inventaire"));
            line.setCountedQuantity(count.countedQuantity());
        }
        return inventoryRepository.save(inventory);
    }

    /** Applique les écarts comptés au stock et enregistre un mouvement "ajustement" par produit. */
    @Transactional
    public InventoryCount close(UUID id) {
        InventoryCount inventory = findOpen(id);
        for (InventoryCountLine line : inventory.getLines()) {
            Integer diff = line.getDifference();
            if (diff == null || diff == 0) continue;
            Product product = line.getProduct();
            product.setStockQuantity(product.getStockQuantity() + diff);
            productRepository.save(product);

            StockMovement movement = new StockMovement();
            movement.setProduct(product);
            movement.setType(StockMovementType.ADJUSTMENT);
            movement.setQuantity(diff);
            movement.setReferenceId(inventory.getId());
            movement.setNote("Inventaire " + inventory.getNumber());
            movementRepository.save(movement);
        }
        inventory.setStatus(InventoryCount.Status.CLOSED);
        inventory.setClosedAt(LocalDateTime.now());
        return inventoryRepository.save(inventory);
    }

    @Transactional
    public InventoryCount cancel(UUID id) {
        InventoryCount inventory = findOpen(id);
        inventory.setStatus(InventoryCount.Status.CANCELLED);
        inventory.setClosedAt(LocalDateTime.now());
        return inventoryRepository.save(inventory);
    }

    @Transactional(readOnly = true)
    public List<InventoryCount> findAll() {
        return inventoryRepository.findAllByOrderByOpenedAtDesc();
    }

    @Transactional(readOnly = true)
    public InventoryCount findById(UUID id) {
        return inventoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Inventaire introuvable"));
    }

    private InventoryCount findOpen(UUID id) {
        InventoryCount inventory = findById(id);
        if (inventory.getStatus() != InventoryCount.Status.OPEN) {
            throw new IllegalArgumentException("Cet inventaire est déjà terminé");
        }
        return inventory;
    }
}
