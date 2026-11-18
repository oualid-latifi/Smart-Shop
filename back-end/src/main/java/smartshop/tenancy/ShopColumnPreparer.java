package smartshop.tenancy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.orm.jpa.EntityManagerFactoryDependsOnPostProcessor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.List;

/**
 * S'exécute AVANT Hibernate. Sur une base créée avant le multi-boutiques, Hibernate voudrait ajouter
 * "shop_id NOT NULL" à des tables qui ont déjà des lignes : PostgreSQL refuse et la colonne manque.
 * On l'ajoute donc ici, vide, sur les tables existantes ; TenancyMigration la remplit ensuite.
 * Sur une base neuve, les tables n'existent pas encore : rien n'est fait, Hibernate les crée normalement.
 */
@Component("shopColumnPreparer")
public class ShopColumnPreparer implements InitializingBean {

    /** Fait attendre Hibernate (EntityManagerFactory) que ce composant ait terminé. */
    @Component
    static class Dependency extends EntityManagerFactoryDependsOnPostProcessor {
        Dependency() {
            super("shopColumnPreparer");
        }
    }

    private static final Logger log = LoggerFactory.getLogger(ShopColumnPreparer.class);

    // Tables des entités qui héritent de TenantEntity (+ les comptes)
    static final List<String> TABLES = List.of(
            "activity_logs", "app_users", "cash_handins", "customers", "customer_payments", "document_counters",
            "expenses", "inventory_counts", "inventory_count_lines", "notifications", "online_orders", "products",
            "promotions", "purchases", "purchase_lines", "purchase_orders", "purchase_order_lines", "purchase_payments",
            "purchase_returns", "quotes", "quote_lines", "sales", "sale_lines", "sale_returns", "sale_return_lines",
            "sales_targets", "shop_settings", "stock_movements", "suppliers", "sync_operations", "warehouses",
            "warehouse_stocks");

    private final JdbcTemplate jdbc;

    public ShopColumnPreparer(DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public void afterPropertiesSet() {
        for (String table : TABLES) {
            try {
                jdbc.execute("alter table if exists " + table + " add column if not exists shop_id uuid");
            } catch (RuntimeException e) {
                log.warn("Colonne shop_id non ajoutée à {} : {}", table, e.getMessage());
            }
        }
    }
}
