package smartshop.service;

import smartshop.exception.ResourceNotFoundException;
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
        if (product.getBarcode() != null && productRepository.findByBarcode(product.getBarcode()).isPresent()) {
            throw new IllegalArgumentException("Ce code-barres est déjà utilisé par un autre produit");
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
                .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable"));
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
        if (data.getBarcode() != null && !data.getBarcode().equals(product.getBarcode())
                && productRepository.findByBarcode(data.getBarcode()).isPresent()) {
            throw new IllegalArgumentException("Ce code-barres est déjà utilisé par un autre produit");
        }
        product.setBarcode(data.getBarcode());
        product.setBrand(data.getBrand());
        product.setModel(data.getModel());
        product.setVariantGroup(data.getVariantGroup());
        product.setColor(data.getColor());
        product.setCapacity(data.getCapacity());
        product.setImageUrl(data.getImageUrl());
        product.setSalePrice(data.getSalePrice());
        product.setVatRate(data.getVatRate());
        product.setUnitsPerPack(data.getUnitsPerPack());
        product.setPackPrice(data.getPackPrice());
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
    public List<Product> findAllById(List<UUID> ids) {
        return productRepository.findAllById(ids);
    }

    /**
     * Nouvelle variante d'un produit : mêmes nom, marque, modèle, TVA, conditionnement, photo et seuil,
     * avec sa propre référence, couleur, capacité, prix et stock (à zéro, il entrera par un achat).
     */
    @Transactional
    public Product createVariant(UUID sourceId, String reference, String color, String capacity, java.math.BigDecimal salePrice, String barcode) {
        Product source = findById(sourceId);
        String group = source.getVariantGroup() != null ? source.getVariantGroup() : source.getName();
        if (source.getVariantGroup() == null) {
            source.setVariantGroup(group);
            productRepository.save(source);
        }
        Product variant = new Product();
        variant.setReference(reference.trim());
        variant.setName(source.getName());
        variant.setBrand(source.getBrand());
        variant.setModel(source.getModel());
        variant.setVariantGroup(group);
        variant.setColor(color != null ? color : source.getColor());
        variant.setCapacity(capacity != null ? capacity : source.getCapacity());
        variant.setBarcode(barcode);
        variant.setImageUrl(source.getImageUrl());
        variant.setSalePrice(salePrice != null ? salePrice : source.getSalePrice());
        // Coût estimé d'après le produit d'origine, corrigé au premier achat
        variant.setAveragePurchasePrice(source.getAveragePurchasePrice());
        variant.setVatRate(source.getVatRate());
        variant.setUnitsPerPack(source.getUnitsPerPack());
        variant.setPackPrice(source.getPackPrice());
        variant.setAlertThreshold(source.getAlertThreshold());
        return create(variant);
    }

    @Transactional(readOnly = true)
    public Product findByBarcode(String barcode) {
        return productRepository.findByBarcode(barcode.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Aucun produit avec ce code-barres"));
    }

    @Transactional(readOnly = true)
    public List<Product> findLowStock() {
        return productRepository.findLowStock();
    }
}
