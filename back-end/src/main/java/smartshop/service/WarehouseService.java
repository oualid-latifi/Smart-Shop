package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.WarehouseDtos.Location;
import smartshop.dto.WarehouseDtos.ProductLocations;
import smartshop.dto.WarehouseDtos.StockLine;
import smartshop.dto.WarehouseDtos.TransferRequest;
import smartshop.dto.WarehouseDtos.WarehouseRequest;
import smartshop.dto.WarehouseDtos.WarehouseResponse;
import smartshop.entity.Product;
import smartshop.entity.StockMovement;
import smartshop.entity.StockMovementType;
import smartshop.entity.Warehouse;
import smartshop.entity.WarehouseStock;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.ProductRepository;
import smartshop.repository.StockMovementRepository;
import smartshop.repository.WarehouseRepository;
import smartshop.repository.WarehouseStockRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Dépôts et transferts de stock entre la boutique et les dépôts. */
@Service
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final WarehouseStockRepository stockRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository movementRepository;

    public WarehouseService(WarehouseRepository warehouseRepository,
                            WarehouseStockRepository stockRepository,
                            ProductRepository productRepository,
                            StockMovementRepository movementRepository) {
        this.warehouseRepository = warehouseRepository;
        this.stockRepository = stockRepository;
        this.productRepository = productRepository;
        this.movementRepository = movementRepository;
    }

    @Transactional(readOnly = true)
    public List<WarehouseResponse> findAll() {
        return warehouseRepository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public WarehouseResponse create(WarehouseRequest request) {
        Warehouse w = new Warehouse();
        w.setName(request.name().trim());
        w.setType(request.type() != null ? request.type() : Warehouse.Type.STORAGE);
        return toResponse(warehouseRepository.save(w));
    }

    @Transactional
    public WarehouseResponse update(UUID id, WarehouseRequest request) {
        Warehouse w = get(id);
        w.setName(request.name().trim());
        if (request.active() != null) {
            if (!request.active() && !stockRepository.findStock(id).isEmpty()) {
                throw new IllegalArgumentException("Vide d'abord ce dépôt avant de le désactiver");
            }
            w.setActive(request.active());
        }
        return toResponse(warehouseRepository.save(w));
    }

    @Transactional(readOnly = true)
    public List<StockLine> stock(UUID id) {
        get(id);
        return stockRepository.findStock(id).stream()
                .map(s -> new StockLine(s.getProduct().getId(), s.getProduct().getName(), s.getProduct().getReference(),
                        s.getQuantity(), s.getProduct().getAveragePurchasePrice().multiply(BigDecimal.valueOf(s.getQuantity()))))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductLocations locations(UUID productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
        List<Location> locations = stockRepository.findByProduct(productId).stream()
                .map(s -> new Location(s.getWarehouse().getId(), s.getWarehouse().getName(), s.getWarehouse().getType(), s.getQuantity()))
                .toList();
        return new ProductLocations(product.getId(), product.getName(), product.getStockQuantity(), locations);
    }

    @Transactional
    public ProductLocations transfer(TransferRequest request) {
        if (request.fromWarehouseId() == null && request.toWarehouseId() == null
                || request.fromWarehouseId() != null && request.fromWarehouseId().equals(request.toWarehouseId())) {
            throw new IllegalArgumentException("Choisis deux emplacements différents");
        }
        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
        int qty = request.quantity();

        // Sortie
        String fromName;
        if (request.fromWarehouseId() == null) {
            if (product.getStockQuantity() < qty) {
                throw new IllegalArgumentException("Stock insuffisant en boutique (" + product.getStockQuantity() + ")");
            }
            product.setStockQuantity(product.getStockQuantity() - qty);
            fromName = "Boutique";
        } else {
            WarehouseStock from = line(get(request.fromWarehouseId()), product);
            if (from.getQuantity() < qty) {
                throw new IllegalArgumentException("Stock insuffisant dans " + from.getWarehouse().getName() + " (" + from.getQuantity() + ")");
            }
            from.setQuantity(from.getQuantity() - qty);
            stockRepository.save(from);
            fromName = from.getWarehouse().getName();
        }

        // Entrée
        String toName;
        if (request.toWarehouseId() == null) {
            product.setStockQuantity(product.getStockQuantity() + qty);
            toName = "Boutique";
        } else {
            Warehouse target = get(request.toWarehouseId());
            if (!target.getActive()) {
                throw new IllegalArgumentException("Le dépôt " + target.getName() + " est désactivé");
            }
            WarehouseStock to = line(target, product);
            to.setQuantity(to.getQuantity() + qty);
            stockRepository.save(to);
            toName = target.getName();
        }
        productRepository.save(product);

        // L'historique des mouvements suit le stock de la boutique
        if (request.fromWarehouseId() == null || request.toWarehouseId() == null) {
            StockMovement movement = new StockMovement();
            movement.setProduct(product);
            movement.setType(request.fromWarehouseId() == null ? StockMovementType.TRANSFER_OUT : StockMovementType.TRANSFER_IN);
            movement.setQuantity(request.fromWarehouseId() == null ? -qty : qty);
            String note = fromName + " → " + toName;
            if (request.note() != null && !request.note().isBlank()) note += " : " + request.note().trim();
            movement.setNote(note.length() > 255 ? note.substring(0, 255) : note);
            movementRepository.save(movement);
        }
        return locations(product.getId());
    }

    private WarehouseStock line(Warehouse warehouse, Product product) {
        return stockRepository.findByWarehouse_IdAndProduct_Id(warehouse.getId(), product.getId())
                .orElseGet(() -> new WarehouseStock(warehouse, product));
    }

    private Warehouse get(UUID id) {
        return warehouseRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Dépôt introuvable"));
    }

    private WarehouseResponse toResponse(Warehouse w) {
        List<WarehouseStock> stock = w.getId() == null ? List.of() : stockRepository.findStock(w.getId());
        int units = stock.stream().mapToInt(WarehouseStock::getQuantity).sum();
        BigDecimal value = stock.stream()
                .map(s -> s.getProduct().getAveragePurchasePrice().multiply(BigDecimal.valueOf(s.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new WarehouseResponse(w.getId(), w.getName(), w.getType(), Boolean.TRUE.equals(w.getActive()), stock.size(), units, value);
    }
}
