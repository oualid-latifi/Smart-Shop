package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Category;
import smartshop.entity.Product;
import smartshop.repository.CategoryRepository;
import smartshop.repository.ProductRepository;

import java.util.List;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    public ProductService(ProductRepository productRepository,
                          CategoryRepository categoryRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public Product create(Product product, UUID categoryId) {
        if (productRepository.existsByReference(product.getReference())) {
            throw new IllegalArgumentException(
                    "Un produit avec la référence " + product.getReference() + " existe déjà");
        }
        product.setCategory(findCategory(categoryId));
        return productRepository.save(product);
    }

    @Transactional(readOnly = true)
    public List<Product> findAllActive() {
        return productRepository.findByActiveTrue();
    }

    @Transactional(readOnly = true)
    public List<Product> findAllIncludingInactive() {
        return productRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Product findById(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
    }

    @Transactional
    public Product update(UUID id, Product data, UUID categoryId) {
        Product product = findById(id);

        if (!product.getReference().equals(data.getReference())
                && productRepository.existsByReference(data.getReference())) {
            throw new IllegalArgumentException(
                    "Un produit avec la référence " + data.getReference() + " existe déjà");
        }
        product.setReference(data.getReference());
        product.setName(data.getName());
        product.setBrand(data.getBrand());
        product.setModel(data.getModel());
        product.setColor(data.getColor());
        product.setCapacity(data.getCapacity());
        product.setImageUrl(data.getImageUrl());
        product.setSalePrice(data.getSalePrice());
        // Le prix de référence peut changer sans réévaluer le coût moyen du stock existant.
        product.setPurchasePrice(data.getPurchasePrice());
        product.setAlertThreshold(data.getAlertThreshold());
        product.setCategory(findCategory(categoryId));
        // Le stock et le coût moyen pondéré restent inchangés lors d'une modification du catalogue.
        return productRepository.save(product);
    }

    @Transactional
    public void activate(UUID id) {
        Product product = findById(id);
        product.setActive(true);
        productRepository.save(product);
    }

    @Transactional
    public void deactivate(UUID id) {
        Product product = findById(id);
        product.setActive(false);
        productRepository.save(product);
    }

    @Transactional(readOnly = true)
    public List<Product> findLowStock() {
        return productRepository.findLowStock();
    }

    private Category findCategory(UUID categoryId) {
        if (categoryId == null) {
            return null;
        }
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));
    }
}
