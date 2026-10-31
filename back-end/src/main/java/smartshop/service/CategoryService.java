package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Category;
import smartshop.repository.CategoryRepository;
import smartshop.repository.ProductRepository;

import java.util.List;
import java.util.UUID;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public CategoryService(CategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    @Transactional
    public Category create(String name) {
        String cleanName = normalize(name);
        if (categoryRepository.existsByNameIgnoreCase(cleanName)) {
            throw new IllegalArgumentException("Cette catégorie existe déjà");
        }
        Category category = new Category();
        category.setName(cleanName);
        return categoryRepository.save(category);
    }

    @Transactional(readOnly = true)
    public List<Category> findAll() {
        return categoryRepository.findAll();
    }

    @Transactional
    public Category rename(UUID id, String name) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));
        String cleanName = normalize(name);
        if (categoryRepository.existsByNameIgnoreCase(cleanName)
                && !category.getName().equalsIgnoreCase(cleanName)) {
            throw new IllegalArgumentException("Cette catégorie existe déjà");
        }
        category.setName(cleanName);
        return categoryRepository.save(category);
    }

    @Transactional
    public void delete(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Catégorie introuvable"));
        if (productRepository.existsByCategoryId(id)) {
            throw new IllegalArgumentException("Impossible de supprimer une catégorie utilisée par des produits. Réaffectez d'abord ces produits.");
        }
        categoryRepository.delete(category);
    }

    private String normalize(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Le nom est obligatoire");
        String clean = name.trim().replaceAll("\\s+", " ");
        if (clean.length() > 100) throw new IllegalArgumentException("Le nom est trop long");
        return clean;
    }
}
