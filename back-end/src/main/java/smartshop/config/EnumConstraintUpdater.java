package smartshop.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import smartshop.entity.CheckStatus;
import smartshop.entity.ExpenseCategory;
import smartshop.entity.InventoryCount;
import smartshop.entity.PaymentMethod;
import smartshop.entity.PurchaseOrder;
import smartshop.entity.QuoteStatus;
import smartshop.entity.Role;
import smartshop.entity.SaleStatus;
import smartshop.entity.StockMovementType;
import smartshop.entity.Warehouse;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Hibernate crée, pour chaque colonne enum, une contrainte CHECK listant les valeurs connues à la création
 * de la table. Avec ddl-auto=update, cette contrainte n'est jamais mise à jour : une nouvelle valeur
 * (ex. PURCHASE_RETURN) est alors refusée par PostgreSQL ("une donnée identique existe déjà…").
 * Au démarrage, on remplace ces contraintes par la liste à jour des valeurs de chaque enum.
 */
@Component
public class EnumConstraintUpdater implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EnumConstraintUpdater.class);

    private record EnumColumn(String table, String column, Class<? extends Enum<?>> type) {
    }

    private static final List<EnumColumn> COLUMNS = List.of(
            new EnumColumn("stock_movements", "type", StockMovementType.class),
            new EnumColumn("sales", "status", SaleStatus.class),
            new EnumColumn("sales", "payment_method", PaymentMethod.class),
            new EnumColumn("customer_payments", "method", PaymentMethod.class),
            new EnumColumn("customer_payments", "check_status", CheckStatus.class),
            new EnumColumn("sale_returns", "refund_method", PaymentMethod.class),
            new EnumColumn("expenses", "category", ExpenseCategory.class),
            new EnumColumn("app_users", "role", Role.class),
            new EnumColumn("quotes", "status", QuoteStatus.class),
            new EnumColumn("purchase_orders", "status", PurchaseOrder.Status.class),
            new EnumColumn("inventory_counts", "status", InventoryCount.Status.class),
            new EnumColumn("warehouses", "type", Warehouse.Type.class),
            new EnumColumn("promotions", "kind", smartshop.entity.Promotion.Kind.class),
            new EnumColumn("notifications", "type", smartshop.entity.Notification.Type.class),
            new EnumColumn("notifications", "audience", smartshop.entity.Permission.class));

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    public EnumConstraintUpdater(DataSource dataSource) {
        this.dataSource = dataSource;
        this.jdbc = new JdbcTemplate(dataSource);
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getDatabaseProductName().toLowerCase().contains("postgres")) {
                return; // H2 des tests : la base est recréée à chaque lancement
            }
        }
        for (EnumColumn c : COLUMNS) {
            try {
                update(c);
            } catch (RuntimeException e) {
                // Ne jamais empêcher le démarrage pour une contrainte : on le signale seulement
                log.warn("Contrainte de {}.{} non mise à jour : {}", c.table(), c.column(), e.getMessage());
            }
        }
    }

    private void update(EnumColumn c) {
        Integer columnExists = jdbc.queryForObject("""
                select count(*) from information_schema.columns
                where table_schema = current_schema() and table_name = ? and column_name = ?
                """, Integer.class, c.table(), c.column());
        if (columnExists == null || columnExists == 0) return;

        String values = Arrays.stream(c.type().getEnumConstants())
                .map(e -> "'" + ((Enum<?>) e).name() + "'")
                .collect(Collectors.joining(", "));

        // Contraintes CHECK existantes sur cette colonne (créées par Hibernate)
        List<String[]> checks = jdbc.query("""
                select con.conname, pg_get_constraintdef(con.oid)
                from pg_constraint con
                join pg_class rel on rel.oid = con.conrelid
                join pg_namespace ns on ns.oid = rel.relnamespace
                join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
                where con.contype = 'c' and ns.nspname = current_schema()
                  and rel.relname = ? and att.attname = ?
                """, (rs, i) -> new String[]{rs.getString(1), rs.getString(2)}, c.table(), c.column());

        boolean upToDate = checks.size() == 1 && Arrays.stream(c.type().getEnumConstants())
                .allMatch(e -> checks.get(0)[1].contains("'" + ((Enum<?>) e).name() + "'"));
        if (upToDate) return;

        for (String[] check : checks) {
            jdbc.execute("alter table " + c.table() + " drop constraint \"" + check[0] + "\"");
        }
        String name = c.table() + "_" + c.column() + "_check";
        jdbc.execute("alter table " + c.table() + " add constraint " + name
                + " check (" + c.column() + " is null or " + c.column() + " in (" + values + "))");
        log.info("Contrainte {} mise à jour : {}", name, values);
    }
}
