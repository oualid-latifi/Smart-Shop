package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Product;
import smartshop.repository.ProductRepository;

import java.util.List;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Transactional
    public Product create(Product product) {
        if (productRepository.existsByReference(product.getReference())) {
            throw new IllegalArgumentException(
                    "Un produit avec la référence " + product.getReference() + " existe déjà");
        }
        return productRepository.save(product);
    }

    @Transactional(readOnly = true)
    public List<Product> findAllActive() {
        return productRepository.findByActiveTrue();
    }

    @Transactional(readOnly = true)
    public Product findById(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
    }

    @Transactional
    public Product update(UUID id, Product data) {
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
        product.setAlertThreshold(data.getAlertThreshold());
        // Le stock et le prix d'achat moyen ne se modifient PAS ici :
        // ils changent uniquement via les achats, les ventes et les ajustements.
        return productRepository.save(product);
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
}
