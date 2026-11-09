package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.PurchaseLineRequest;
import smartshop.dto.PurchaseOrderDtos.CreateRequest;
import smartshop.dto.PurchaseOrderDtos.ReceiveLine;
import smartshop.dto.PurchaseOrderDtos.ReceiveRequest;
import smartshop.dto.PurchaseRequest;
import smartshop.entity.DocumentType;
import smartshop.entity.Product;
import smartshop.entity.Purchase;
import smartshop.entity.PurchaseOrder;
import smartshop.entity.PurchaseOrderLine;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.ProductRepository;
import smartshop.repository.PurchaseOrderRepository;
import smartshop.repository.PurchaseRepository;
import smartshop.repository.SupplierRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PurchaseOrderService {

    private final PurchaseOrderRepository orderRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final PurchaseRepository purchaseRepository;
    private final PurchaseService purchaseService;
    private final NumberingService numberingService;

    public PurchaseOrderService(PurchaseOrderRepository orderRepository,
                                SupplierRepository supplierRepository,
                                ProductRepository productRepository,
                                PurchaseRepository purchaseRepository,
                                PurchaseService purchaseService,
                                NumberingService numberingService) {
        this.orderRepository = orderRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.purchaseRepository = purchaseRepository;
        this.purchaseService = purchaseService;
        this.numberingService = numberingService;
    }

    @Transactional
    public PurchaseOrder create(CreateRequest request) {
        PurchaseOrder order = new PurchaseOrder();
        order.setSupplier(supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Fournisseur introuvable")));
        order.setExpectedDate(request.expectedDate());
        order.setNote(request.note() != null && !request.note().isBlank() ? request.note().trim() : null);

        for (PurchaseLineRequest l : request.lines()) {
            Product product = productRepository.findById(l.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
            boolean byPack = Boolean.TRUE.equals(l.packs());
            if (byPack && product.getUnitsPerPack() == null) {
                throw new IllegalArgumentException("Le produit " + product.getName() + " n'a pas de conditionnement en carton");
            }
            PurchaseOrderLine line = new PurchaseOrderLine();
            line.setProduct(product);
            line.setQuantity(byPack ? l.quantity() * product.getUnitsPerPack() : l.quantity());
            line.setUnitPrice(byPack
                    ? l.unitPrice().divide(BigDecimal.valueOf(product.getUnitsPerPack()), 2, RoundingMode.HALF_UP)
                    : l.unitPrice());
            order.addLine(line);
        }
        order.setNumber(numberingService.next(DocumentType.PURCHASE_ORDER));
        return orderRepository.save(order);
    }

    /** Réception (totale ou partielle) : crée un achat, fait entrer le stock et met à jour le statut du bon. */
    @Transactional
    public Purchase receive(UUID id, ReceiveRequest request) {
        PurchaseOrder order = findById(id);
        if (order.getStatus() == PurchaseOrder.Status.RECEIVED || order.getStatus() == PurchaseOrder.Status.CANCELLED) {
            throw new IllegalArgumentException("Ce bon de commande est clôturé");
        }

        List<PurchaseLineRequest> purchaseLines = new ArrayList<>();
        List<ReceiveLine> requested = request != null && request.lines() != null && !request.lines().isEmpty()
                ? request.lines()
                : order.getLines().stream()
                    .filter(l -> l.getRemainingQuantity() > 0)
                    .map(l -> new ReceiveLine(l.getProduct().getId(), l.getRemainingQuantity()))
                    .toList();

        for (ReceiveLine r : requested) {
            PurchaseOrderLine line = order.getLines().stream()
                    .filter(l -> l.getProduct().getId().equals(r.productId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Ce produit ne fait pas partie du bon de commande"));
            if (r.quantity() > line.getRemainingQuantity()) {
                throw new IllegalArgumentException("Quantité reçue trop grande pour " + line.getProduct().getName()
                        + " (reste à recevoir : " + line.getRemainingQuantity() + ")");
            }
            line.setReceivedQuantity(line.getReceivedQuantity() + r.quantity());
            purchaseLines.add(new PurchaseLineRequest(r.productId(), r.quantity(), line.getUnitPrice(), false));
        }
        if (purchaseLines.isEmpty()) {
            throw new IllegalArgumentException("Rien à recevoir");
        }

        Purchase purchase = purchaseService.create(new PurchaseRequest(
                order.getSupplier().getId(),
                request != null ? request.amountPaid() : null,
                "Réception " + order.getNumber(),
                purchaseLines));
        purchase.setPurchaseOrderId(order.getId());
        purchaseRepository.save(purchase);

        boolean complete = order.getLines().stream().allMatch(l -> l.getRemainingQuantity() == 0);
        order.setStatus(complete ? PurchaseOrder.Status.RECEIVED : PurchaseOrder.Status.PARTIALLY_RECEIVED);
        orderRepository.save(order);
        return purchase;
    }

    @Transactional
    public PurchaseOrder cancel(UUID id) {
        PurchaseOrder order = findById(id);
        if (order.getStatus() != PurchaseOrder.Status.ORDERED) {
            throw new IllegalArgumentException("Seul un bon de commande non reçu peut être annulé");
        }
        order.setStatus(PurchaseOrder.Status.CANCELLED);
        return orderRepository.save(order);
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrder> findAll() {
        return orderRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public PurchaseOrder findById(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bon de commande introuvable"));
    }
}
