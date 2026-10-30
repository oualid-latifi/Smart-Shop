package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Category;
import smartshop.repository.CategoryRepository;

import java.util.List;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public Category create(String name) {
        if (categoryRepository.existsByName(name)) {
            throw new IllegalArgumentException("La catégorie " + name + " existe déjà");
        }
        Category category = new Category();
        category.setName(name);
        return categoryRepository.save(category);
    }

    @Transactional(readOnly = true)
    public List<Category> findAll() {
        return categoryRepository.findAll();
    }
}
