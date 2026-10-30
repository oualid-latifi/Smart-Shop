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

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody ProductCreateRequest request) {
        Product product = new Product();
        product.setReference(request.reference());
        product.setName(request.name());
        product.setSalePrice(request.salePrice());
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
        return ProductResponse.from(productService.create(product, request.categoryId()));
    }

    @GetMapping
    public List<ProductResponse> findAll() {
        return productService.findAllActive().stream().map(ProductResponse::from).toList();
    }

    @GetMapping("/low-stock")
    public List<ProductResponse> findLowStock() {
        return productService.findLowStock().stream().map(ProductResponse::from).toList();
    }

    @GetMapping("/{id}")
    public ProductResponse findById(@PathVariable UUID id) {
        return ProductResponse.from(productService.findById(id));
    }

    @PutMapping("/{id}")
    public ProductResponse update(@PathVariable UUID id,
                                  @Valid @RequestBody ProductUpdateRequest request) {
        Product data = new Product();
        data.setReference(request.reference());
        data.setName(request.name());
        data.setSalePrice(request.salePrice());
        data.setAlertThreshold(request.alertThreshold());
        data.setBrand(request.brand());
        data.setModel(request.model());
        data.setColor(request.color());
        data.setCapacity(request.capacity());
        data.setImageUrl(request.imageUrl());
        return ProductResponse.from(productService.update(id, data, request.categoryId()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable UUID id) {
        productService.deactivate(id);
    }
}
