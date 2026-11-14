package smartshop.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.SaleLineRequest;
import smartshop.dto.SaleRequest;
import smartshop.entity.Customer;
import smartshop.entity.DocumentType;
import smartshop.entity.Notification;
import smartshop.entity.OnlineOrder;
import smartshop.entity.Permission;
import smartshop.entity.Product;
import smartshop.entity.Promotion;
import smartshop.entity.Sale;
import smartshop.entity.ShopSettings;
import smartshop.exception.ResourceNotFoundException;
import smartshop.exception.TooManyAttemptsException;
import smartshop.repository.CustomerRepository;
import smartshop.repository.OnlineOrderRepository;
import smartshop.repository.ProductRepository;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Boutique en ligne : catalogue public (prix promotions comprises, jamais les prix d'achat ni les quantités)
 * et commandes des clients, confirmées puis transformées en vente par la boutique.
 */
@Service
public class OnlineShopService {

    // Anti-abus : 5 commandes par adresse IP toutes les 10 minutes
    private static final int MAX_ORDERS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    public record CatalogProduct(UUID id, String name, String brand, String variantGroup, String color, String capacity,
                                 String imageUrl, BigDecimal price, BigDecimal oldPrice, String promotion, boolean inStock) {
    }

    public record Catalog(String shopName, String phone, String address, String city, List<CatalogProduct> products) {
    }

    public record OrderLineRequest(@NotNull UUID productId, @NotNull @Min(1) @Max(20) Integer quantity) {
    }

    public record OrderRequest(@NotBlank @Size(max = 100) String name,
                               @NotBlank @Pattern(regexp = "^[+0-9 ().-]{8,20}$", message = "Numéro de téléphone invalide") String phone,
                               @Size(max = 255) String address,
                               @Size(max = 500) String note,
                               @NotEmpty @Size(max = 20) List<@Valid OrderLineRequest> lines) {
    }

    public record OrderPlaced(String number, BigDecimal total) {
    }

    public record OrderLineResponse(UUID productId, String productName, int quantity, BigDecimal unitPrice, BigDecimal lineTotal) {
    }

    public record OrderResponse(UUID id, String number, String customerName, String phone, String address, String note,
                                OnlineOrder.Status status, BigDecimal total, LocalDateTime createdAt, UUID saleId,
                                List<OrderLineResponse> lines) {
        static OrderResponse from(OnlineOrder o) {
            return new OrderResponse(o.getId(), o.getNumber(), o.getCustomerName(), o.getPhone(), o.getAddress(), o.getNote(),
                    o.getStatus(), o.getTotal(), o.getCreatedAt(), o.getSaleId(),
                    o.getLines().stream().map(l -> new OrderLineResponse(l.getProductId(), l.getProductName(), l.getQuantity(),
                            l.getUnitPrice(), l.getUnitPrice().multiply(BigDecimal.valueOf(l.getQuantity())))).toList());
        }
    }

    private final OnlineOrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;
    private final PromotionService promotionService;
    private final ShopSettingsService settingsService;
    private final NumberingService numberingService;
    private final NotificationService notificationService;
    private final SaleService saleService;
    private final Map<String, Deque<Instant>> recentOrders = new ConcurrentHashMap<>();

    public OnlineShopService(OnlineOrderRepository orderRepository, ProductRepository productRepository,
                             CustomerRepository customerRepository, PromotionService promotionService,
                             ShopSettingsService settingsService, NumberingService numberingService,
                             NotificationService notificationService, SaleService saleService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
        this.promotionService = promotionService;
        this.settingsService = settingsService;
        this.numberingService = numberingService;
        this.notificationService = notificationService;
        this.saleService = saleService;
    }

    // ---------------------------------------------------------------- Public

    @Transactional(readOnly = true)
    public Catalog catalog() {
        ShopSettings settings = requireEnabled();
        List<Promotion> running = promotionService.running();
        List<CatalogProduct> products = productRepository.findByActiveTrue().stream()
                .sorted(Comparator.comparing((Product p) -> p.getStockQuantity() <= 0).thenComparing(Product::getName, String.CASE_INSENSITIVE_ORDER))
                .map(p -> {
                    PromotionService.Offer offer = promotionService.bestOffer(p, running);
                    BigDecimal price = PromotionService.lineUnitPrice(p, offer, 1);
                    boolean discounted = offer != null && price.compareTo(p.getSalePrice()) < 0;
                    return new CatalogProduct(p.getId(), p.getName(), p.getBrand(), p.getVariantGroup(), p.getColor(), p.getCapacity(),
                            p.getImageUrl(), price, discounted ? p.getSalePrice() : null, offer != null ? offer.label() : null,
                            p.getStockQuantity() > 0);
                })
                .toList();
        return new Catalog(settings.getShopName() != null ? settings.getShopName() : "SmartShop",
                settings.getPhone(), settings.getAddress(), settings.getCity(), products);
    }

    @Transactional
    public OrderPlaced place(OrderRequest request, String clientIp) {
        requireEnabled();
        throttle(clientIp);

        List<Promotion> running = promotionService.running();
        OnlineOrder order = new OnlineOrder();
        order.setCustomerName(request.name().trim());
        order.setPhone(request.phone().trim());
        order.setAddress(blankToNull(request.address()));
        order.setNote(blankToNull(request.note()));
        Set<UUID> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (OrderLineRequest line : request.lines()) {
            if (!seen.add(line.productId())) throw new IllegalArgumentException("Produit en double dans la commande");
            Product p = productRepository.findById(line.productId())
                    .filter(Product::getActive)
                    .orElseThrow(() -> new IllegalArgumentException("Un produit de la commande n'est plus disponible"));
            if (p.getStockQuantity() < line.quantity()) {
                throw new IllegalArgumentException(p.getStockQuantity() <= 0
                        ? p.getName() + " est en rupture de stock"
                        : "Il ne reste que " + p.getStockQuantity() + " × " + p.getName());
            }
            BigDecimal unit = PromotionService.lineUnitPrice(p, promotionService.bestOffer(p, running), line.quantity());
            order.getLines().add(new OnlineOrder.Line(p.getId(), p.getName(), line.quantity(), unit));
            total = total.add(unit.multiply(BigDecimal.valueOf(line.quantity())));
        }
        order.setTotal(total);
        order.setNumber(numberingService.next(DocumentType.ONLINE_ORDER));
        orderRepository.save(order);

        notificationService.notify(Notification.Type.ONLINE_ORDER, "Nouvelle commande en ligne : " + order.getNumber(),
                order.getCustomerName() + " · " + DocumentPdfService.money(total) + " DH", Permission.SALES, order.getId(),
                "online-order:" + order.getId());
        return new OrderPlaced(order.getNumber(), total);
    }

    // ---------------------------------------------------------------- Boutique

    @Transactional(readOnly = true)
    public List<OrderResponse> list(OnlineOrder.Status status) {
        List<OnlineOrder> orders = status == null
                ? orderRepository.findTop100ByOrderByCreatedAtDesc()
                : orderRepository.findTop100ByStatusOrderByCreatedAtDesc(status);
        return orders.stream().map(OrderResponse::from).toList();
    }

    @Transactional
    public OrderResponse setStatus(UUID id, OnlineOrder.Status status) {
        if (status == OnlineOrder.Status.CONVERTED) throw new IllegalArgumentException("Utilise « Transformer en vente »");
        OnlineOrder order = find(id);
        if (order.getStatus() == OnlineOrder.Status.CONVERTED) throw new IllegalArgumentException("Cette commande est déjà une vente");
        order.setStatus(status);
        return OrderResponse.from(orderRepository.save(order));
    }

    /** Crée la vente (le stock baisse à ce moment-là) et rattache le client, retrouvé par son téléphone ou créé. */
    @Transactional
    public Sale convert(UUID id, BigDecimal amountPaid) {
        OnlineOrder order = find(id);
        if (order.getStatus() == OnlineOrder.Status.CONVERTED) throw new IllegalArgumentException("Cette commande est déjà une vente");
        if (order.getStatus() == OnlineOrder.Status.CANCELLED) throw new IllegalArgumentException("Cette commande a été annulée");

        Customer customer = customerRepository.findFirstByPhone(order.getPhone()).orElseGet(() -> {
            Customer c = new Customer();
            c.setName(order.getCustomerName());
            c.setPhone(order.getPhone());
            c.setAddress(order.getAddress());
            return customerRepository.save(c);
        });
        List<SaleLineRequest> lines = order.getLines().stream()
                .map(l -> new SaleLineRequest(l.getProductId(), l.getQuantity(), l.getUnitPrice(), false))
                .toList();
        Sale sale = saleService.create(new SaleRequest(customer.getId(), null, null, amountPaid, null, null, lines, null));
        order.setStatus(OnlineOrder.Status.CONVERTED);
        order.setSaleId(sale.getId());
        orderRepository.save(order);
        return sale;
    }

    public long pendingCount() {
        return orderRepository.countByStatus(OnlineOrder.Status.NEW);
    }

    private OnlineOrder find(UUID id) {
        return orderRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Commande introuvable"));
    }

    private ShopSettings requireEnabled() {
        ShopSettings settings = settingsService.get();
        if (!Boolean.TRUE.equals(settings.getOnlineShopEnabled())) throw new ResourceNotFoundException("La boutique en ligne n'est pas ouverte");
        return settings;
    }

    private void throttle(String ip) {
        Instant now = Instant.now();
        Deque<Instant> times = recentOrders.computeIfAbsent(ip == null ? "?" : ip, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst().isBefore(now.minus(WINDOW))) times.pollFirst();
            if (times.size() >= MAX_ORDERS) {
                throw new TooManyAttemptsException("Trop de commandes envoyées. Réessaie dans quelques minutes ou appelle la boutique.",
                        Duration.between(now, times.peekFirst().plus(WINDOW)));
            }
            times.addLast(now);
        }
        // Ménage : on oublie les adresses inactives
        if (recentOrders.size() > 10_000) recentOrders.entrySet().removeIf(e -> e.getValue().isEmpty());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
