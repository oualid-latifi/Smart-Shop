package smartshop.tenancy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import smartshop.entity.Shop;
import smartshop.service.NumberingService;
import smartshop.service.ShopService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Passage au multi-boutiques d'une base existante (une seule fois, au démarrage) :
 * 1. les données d'avant sont rattachées à une première boutique ;
 * 2. les compteurs de numérotation reçoivent le préfixe de cette boutique (la suite des numéros continue) ;
 * 3. PostgreSQL : les anciennes contraintes "numéro unique dans toute la base" sont retirées
 *    (remplacées par "unique dans chaque boutique").
 */
@Component
@Order(0)
public class TenancyMigration implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(TenancyMigration.class);

    // Colonnes autrefois uniques dans toute la base, désormais uniques par boutique
    private static final List<String[]> LEGACY_UNIQUE = List.of(
            new String[]{"products", "reference"}, new String[]{"products", "barcode"},
            new String[]{"sales", "number"}, new String[]{"sales", "invoice_number"}, new String[]{"sales", "delivery_number"},
            new String[]{"quotes", "number"}, new String[]{"purchase_orders", "number"},
            new String[]{"inventory_counts", "number"}, new String[]{"online_orders", "number"});

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;
    private final ShopService shopService;

    public TenancyMigration(DataSource dataSource, ShopService shopService) {
        this.dataSource = dataSource;
        this.jdbc = new JdbcTemplate(dataSource);
        this.shopService = shopService;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            attachExistingData();
        } catch (RuntimeException e) {
            log.error("Rattachement des données existantes à une boutique impossible", e);
        }
        try {
            dropLegacyUniqueConstraints();
        } catch (Exception e) {
            log.warn("Anciennes contraintes d'unicité non retirées : {}", e.getMessage());
        }
    }

    private void attachExistingData() {
        Integer shops = jdbc.queryForObject("select count(*) from shops", Integer.class);
        Integer orphans = jdbc.queryForObject("select count(*) from app_users where shop_id is null", Integer.class);
        if (orphans == null || orphans == 0) return;

        UUID shopId;
        if (shops != null && shops > 0) {
            shopId = jdbc.queryForObject("select id from shops order by created_at limit 1", UUID.class);
        } else {
            List<String> names = jdbc.queryForList("select shop_name from shop_settings where shop_name is not null", String.class);
            Shop shop = shopService.create(names.isEmpty() ? "Ma boutique" : names.get(0));
            shopId = shop.getId();
            log.info("Données existantes rattachées à la boutique « {} » (/shop/{})", shop.getName(), shop.getSlug());
        }

        for (String table : tablesWithShopColumn()) {
            int n = jdbc.update("update " + table + " set shop_id = ? where shop_id is null", shopId);
            if (n > 0) log.info("{} : {} ligne(s) rattachée(s) à la boutique", table, n);
        }
        // "FAC-2026" -> "1f3a9c2b7d:FAC-2026" : la boutique garde la suite de ses numéros
        String prefix = NumberingService.counterKey(shopId, "");
        jdbc.update("update document_counters set counter_key = ? || counter_key where counter_key not like '%:%'", prefix);
    }

    private List<String> tablesWithShopColumn() {
        List<String> tables = new ArrayList<>();
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData meta = connection.getMetaData();
            for (String pattern : List.of("shop_id", "SHOP_ID")) {
                try (ResultSet rs = meta.getColumns(connection.getCatalog(), connection.getSchema(), "%", pattern)) {
                    while (rs.next()) {
                        String table = rs.getString("TABLE_NAME").toLowerCase(Locale.ROOT);
                        if (table.matches("[a-z0-9_]+") && !tables.contains(table)) tables.add(table);
                    }
                }
            }
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return tables;
    }

    private void dropLegacyUniqueConstraints() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT).contains("postgres")) return;
        }
        for (String[] tc : LEGACY_UNIQUE) {
            List<String> names = jdbc.queryForList("""
                    select c.conname from pg_constraint c
                    join pg_class t on t.oid = c.conrelid
                    join pg_attribute a on a.attrelid = t.oid and a.attnum = any(c.conkey)
                    where c.contype = 'u' and t.relname = ? and array_length(c.conkey, 1) = 1 and a.attname = ?
                    """, String.class, tc[0], tc[1]);
            for (String name : names) {
                if (!name.matches("[A-Za-z0-9_]+")) continue;
                jdbc.execute("alter table " + tc[0] + " drop constraint " + name);
                log.info("Contrainte {} retirée : {}.{} est maintenant unique par boutique", name, tc[0], tc[1]);
            }
        }
    }
}
