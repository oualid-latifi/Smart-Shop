package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.ProductCreateRequest;
import smartshop.dto.ProductResponse;
import smartshop.dto.ProductUpdateRequest;
import smartshop.entity.Product;
import smartshop.service.ProductService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final smartshop.service.PromotionService promotionService;
    private final smartshop.service.LabelPdfService labelPdfService;

    public ProductController(ProductService productService, smartshop.service.PromotionService promotionService,
                             smartshop.service.LabelPdfService labelPdfService) {
        this.productService = productService;
        this.promotionService = promotionService;
        this.labelPdfService = labelPdfService;
    }

    // Ajoute la promotion en cours à chaque produit
    private List<ProductResponse> withOffers(List<Product> products) {
        var running = promotionService.running();
        return products.stream().map(p -> ProductResponse.from(p, promotionService.bestOffer(p, running))).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody ProductCreateRequest request) {
        Product product = new Product();
        product.setReference(request.reference());
        product.setName(request.name());
        product.setBarcode(request.barcode() == null || request.barcode().isBlank() ? null : request.barcode().trim());
        product.setSalePrice(request.salePrice());
        product.setVatRate(request.vatRate());
        product.setUnitsPerPack(request.unitsPerPack());
        product.setPackPrice(request.packPrice());
        if (request.purchasePrice() != null) {
            product.setAveragePurchasePrice(request.purchasePrice());
        }
        if (request.initialStock() != null) {
            product.setStockQuantity(request.initialStock());
        }
        if (request.alertThreshold() != null) {
            product.setAlertThreshold(request.alertThreshold());
        }
        product.setBrand(request.brand());
        product.setModel(request.model());
        product.setVariantGroup(blankToNull(request.variantGroup()));
        product.setColor(request.color());
        product.setCapacity(request.capacity());
        product.setImageUrl(request.imageUrl());
        return ProductResponse.from(productService.create(product));
    }

    @GetMapping
    public List<ProductResponse> findAll() {
        return withOffers(productService.findAllActive());
    }

    // Recherche par code-barres (scanner de l'application)
    @GetMapping("/barcode/{code}")
    public ProductResponse findByBarcode(@PathVariable String code) {
        return withOffers(List.of(productService.findByBarcode(code))).get(0);
    }

    public record VariantRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 50) String reference,
                                 @jakarta.validation.constraints.Size(max = 50) String color,
                                 @jakarta.validation.constraints.Size(max = 60) String capacity,
                                 @jakarta.validation.constraints.DecimalMin("0.00") java.math.BigDecimal salePrice,
                                 @jakarta.validation.constraints.Size(max = 64) String barcode) {
    }

    // Crée une variante (autre couleur / capacité) à partir d'un produit existant
    @PostMapping("/{id}/variants")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse createVariant(@PathVariable UUID id, @Valid @RequestBody VariantRequest request) {
        return ProductResponse.from(productService.createVariant(id, request.reference(), blankToNull(request.color()),
                blankToNull(request.capacity()), request.salePrice(), blankToNull(request.barcode())));
    }

    // Étiquettes : ?ids=a,b&copies=2&format=A4|THERMAL (sans ids : tous les produits actifs)
    @GetMapping("/labels.pdf")
    public org.springframework.http.ResponseEntity<byte[]> labels(@RequestParam(required = false) List<UUID> ids,
                                                                  @RequestParam(defaultValue = "1") int copies,
                                                                  @RequestParam(defaultValue = "A4") smartshop.service.LabelPdfService.Format format) {
        List<Product> products = ids == null || ids.isEmpty() ? productService.findAllActive() : productService.findAllById(ids);
        var running = promotionService.running();
        java.util.Map<UUID, java.math.BigDecimal> prices = new java.util.HashMap<>();
        for (Product p : products) {
            var offer = promotionService.bestOffer(p, running);
            if (offer != null && offer.unitPrice() != null) prices.put(p.getId(), offer.unitPrice());
        }
        return smartshop.service.DocumentPdfService.inline("etiquettes.pdf", labelPdfService.labels(products, copies, format, prices));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @GetMapping("/low-stock")
    public List<ProductResponse> findLowStock() {
        return productService.findLowStock().stream().map(ProductResponse::from).toList();
    }

    @GetMapping("/{id}")
    public ProductResponse findById(@PathVariable UUID id) {
        return withOffers(List.of(productService.findById(id))).get(0);
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable UUID id,
                                  @Valid @RequestBody ProductUpdateRequest request) {
        Product data = new Product();
        data.setReference(request.reference());
        data.setName(request.name());
        data.setBarcode(request.barcode() == null || request.barcode().isBlank() ? null : request.barcode().trim());
        data.setSalePrice(request.salePrice());
        data.setVatRate(request.vatRate());
        data.setUnitsPerPack(request.unitsPerPack());
        data.setPackPrice(request.packPrice());
        data.setAlertThreshold(request.alertThreshold());
        data.setBrand(request.brand());
        data.setModel(request.model());
        data.setVariantGroup(blankToNull(request.variantGroup()));
        data.setColor(request.color());
        data.setCapacity(request.capacity());
        data.setImageUrl(request.imageUrl());
        return ProductResponse.from(productService.update(id, data));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable UUID id) {
        productService.deactivate(id);
    }
}
