package smartshop.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Removes the retired product-category schema without touching product records.
 * PostgreSQL keeps every product; only the obsolete relation and table are dropped.
 */
@Component
public class RemoveProductCategories implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public RemoveProductCategories(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("ALTER TABLE products DROP COLUMN IF EXISTS category_id");
        jdbcTemplate.execute("DROP TABLE IF EXISTS categories");
    }
}
