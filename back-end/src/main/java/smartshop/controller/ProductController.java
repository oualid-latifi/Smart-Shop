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

    public ProductController(ProductService productService, smartshop.service.PromotionService promotionService) {
        this.productService = productService;
        this.promotionService = promotionService;
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
