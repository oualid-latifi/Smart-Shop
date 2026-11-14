package smartshop.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Sauvegarde complète de la base dans un fichier ZIP (un fichier JSON par table + un manifeste),
 * faite chaque nuit et à la demande. La restauration remplace toutes les données par celles du fichier.
 * Les tables sont vidées puis rechargées dans l'ordre des clés étrangères : aucun droit
 * "superutilisateur" n'est nécessaire, ce qui fonctionne aussi sur une base PostgreSQL hébergée.
 */
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final DateTimeFormatter NAME = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss");
    private static final String PREFIX = "smartshop-";

    public record BackupInfo(String name, long size, LocalDateTime createdAt) {
    }

    private record Manifest(int version, String createdAt, List<String> tables, Map<String, Integer> rows) {
    }

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final Path dir;
    private final int keep;
    private final NotificationService notificationService;

    public BackupService(DataSource dataSource, ObjectMapper json,
                         @Value("${app.backup.dir:backups}") String dir,
                         @Value("${app.backup.keep:14}") int keep,
                         @org.springframework.context.annotation.Lazy NotificationService notificationService) {
        this.dataSource = dataSource;
        this.jdbc = new JdbcTemplate(dataSource);
        this.json = json;
        this.dir = Path.of(dir).toAbsolutePath();
        this.keep = Math.max(1, keep);
        this.notificationService = notificationService;
    }

    // Chaque nuit (heure du Maroc), désactivable avec BACKUP_CRON=-
    @Scheduled(cron = "${app.backup.cron:0 30 2 * * *}")
    public void nightly() {
        try {
            BackupInfo info = create();
            log.info("Sauvegarde automatique : {} ({} octets)", info.name(), info.size());
        } catch (Exception e) {
            log.error("Sauvegarde automatique impossible", e);
            notificationService.notify(smartshop.entity.Notification.Type.BACKUP_FAILED, "Sauvegarde automatique échouée",
                    String.valueOf(e.getMessage()), smartshop.entity.Permission.SETTINGS, null, "backup-failed:" + java.time.LocalDate.now());
        }
    }

    /** Crée une sauvegarde sur le disque du serveur et supprime les plus anciennes. */
    public BackupInfo create() throws IOException {
        byte[] zip = export();
        Files.createDirectories(dir);
        String name = PREFIX + NAME.format(LocalDateTime.now()) + ".zip";
        Path file = dir.resolve(name);
        Files.write(file, zip);
        prune();
        return new BackupInfo(name, zip.length, LocalDateTime.now());
    }

    public List<BackupInfo> list() throws IOException {
        if (!Files.isDirectory(dir)) return List.of();
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(p -> p.getFileName().toString().matches(PREFIX + "[0-9_-]+\\.zip"))
                    .map(p -> {
                        try {
                            return new BackupInfo(p.getFileName().toString(), Files.size(p),
                                    LocalDateTime.ofInstant(Files.getLastModifiedTime(p).toInstant(), java.time.ZoneId.systemDefault()));
                        } catch (IOException e) {
                            throw new IllegalStateException(e);
                        }
                    })
                    .sorted(Comparator.comparing(BackupInfo::createdAt).reversed())
                    .toList();
        }
    }

    public byte[] read(String name) throws IOException {
        return Files.readAllBytes(resolve(name));
    }

    /** Toutes les tables -> ZIP (JSON). */
    @Transactional(readOnly = true)
    public byte[] export() throws IOException {
        List<String> tables = tablesInDependencyOrder();
        Map<String, Integer> counts = new LinkedHashMap<>();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            for (String table : tables) {
                List<Map<String, Object>> rows = jdbc.query("select * from " + quote(table), (rs, i) -> row(rs));
                counts.put(table, rows.size());
                zip.putNextEntry(new ZipEntry(table + ".json"));
                zip.write(json.writeValueAsBytes(rows));
                zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(json.writeValueAsBytes(new Manifest(1, LocalDateTime.now().toString(), tables, counts)));
            zip.closeEntry();
        }
        return out.toByteArray();
    }

    /**
     * Remplace toutes les données par celles de la sauvegarde, en une seule transaction :
     * si une ligne échoue, rien n'est modifié.
     */
    @Transactional
    public Map<String, Integer> restore(byte[] zip) throws IOException {
        Map<String, byte[]> entries = new HashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) entries.put(entry.getName(), in.readAllBytes());
        }
        if (!entries.containsKey("manifest.json")) {
            throw new IllegalArgumentException("Ce fichier n'est pas une sauvegarde SmartShop");
        }
        Manifest manifest = json.readValue(entries.get("manifest.json"), Manifest.class);

        // Tables actuelles : parents d'abord. On vide dans l'ordre inverse, on recharge dans l'ordre.
        List<String> order = tablesInDependencyOrder();
        for (int i = order.size() - 1; i >= 0; i--) jdbc.update("delete from " + quote(order.get(i)));

        Map<String, Integer> restored = new LinkedHashMap<>();
        for (String table : order) {
            if (!manifest.tables().contains(table) || !entries.containsKey(table + ".json")) continue;
            List<Map<String, Object>> rows = json.readValue(entries.get(table + ".json"), new TypeReference<>() {
            });
            Map<String, Integer> types = columnTypes(table);
            for (Map<String, Object> row : rows) {
                List<String> columns = row.keySet().stream().filter(types::containsKey).toList();
                if (columns.isEmpty()) continue;
                String sql = "insert into " + quote(table) + " (" + String.join(", ", columns.stream().map(BackupService::quote).toList())
                        + ") values (" + String.join(", ", columns.stream().map(c -> "?").toList()) + ")";
                Object[] values = columns.stream().map(c -> convert(row.get(c), types.get(c))).toArray();
                jdbc.update(sql, values);
            }
            restored.put(table, rows.size());
        }
        return restored;
    }

    // ---------------------------------------------------------------- Outils

    private Map<String, Object> row(ResultSet rs) throws SQLException {
        ResultSetMetaData meta = rs.getMetaData();
        Map<String, Object> row = new LinkedHashMap<>();
        for (int c = 1; c <= meta.getColumnCount(); c++) {
            Object value = rs.getObject(c);
            if (value instanceof java.sql.Timestamp ts) value = ts.toLocalDateTime().toString();
            else if (value instanceof java.sql.Date d) value = d.toLocalDate().toString();
            else if (value instanceof java.sql.Time t) value = t.toLocalTime().toString();
            else if (value instanceof UUID u) value = u.toString();
            else if (value instanceof java.time.temporal.Temporal) value = value.toString();
            else if (value instanceof BigDecimal b) value = b.toPlainString();
            row.put(meta.getColumnLabel(c).toLowerCase(Locale.ROOT), value);
        }
        return row;
    }

    /** Valeur JSON -> type Java attendu par la colonne (dates, montants, identifiants…). */
    private static Object convert(Object value, int sqlType) {
        if (value == null) return null;
        String text = value.toString();
        return switch (sqlType) {
            case Types.TIMESTAMP, Types.TIMESTAMP_WITH_TIMEZONE -> java.sql.Timestamp.valueOf(LocalDateTime.parse(text));
            case Types.DATE -> java.sql.Date.valueOf(LocalDate.parse(text));
            case Types.TIME -> java.sql.Time.valueOf(LocalTime.parse(text));
            case Types.NUMERIC, Types.DECIMAL -> new BigDecimal(text);
            case Types.INTEGER, Types.SMALLINT, Types.TINYINT -> Integer.valueOf(text);
            case Types.BIGINT -> Long.valueOf(text);
            case Types.BOOLEAN, Types.BIT -> Boolean.valueOf(text);
            case Types.DOUBLE, Types.FLOAT, Types.REAL -> Double.valueOf(text);
            case Types.BINARY, Types.OTHER, Types.JAVA_OBJECT -> text.matches("[0-9a-fA-F-]{36}") ? UUID.fromString(text) : value;
            default -> value;
        };
    }

    private Map<String, Integer> columnTypes(String table) {
        return jdbc.query("select * from " + quote(table) + " where 1 = 0", rs -> {
            ResultSetMetaData meta = rs.getMetaData();
            Map<String, Integer> types = new HashMap<>();
            for (int c = 1; c <= meta.getColumnCount(); c++) {
                types.put(meta.getColumnLabel(c).toLowerCase(Locale.ROOT), meta.getColumnType(c));
            }
            return types;
        });
    }

    /** Tables de l'application, triées pour que chaque table vienne après celles qu'elle référence. */
    private List<String> tablesInDependencyOrder() {
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData meta = connection.getMetaData();
            String schema = connection.getSchema();
            Set<String> tables = new LinkedHashSet<>();
            try (ResultSet rs = meta.getTables(connection.getCatalog(), schema, "%", new String[]{"TABLE"})) {
                while (rs.next()) tables.add(rs.getString("TABLE_NAME").toLowerCase(Locale.ROOT));
            }
            Map<String, Set<String>> parents = new HashMap<>();
            for (String table : tables) {
                Set<String> refs = new LinkedHashSet<>();
                for (String name : List.of(table, table.toUpperCase(Locale.ROOT))) {
                    try (ResultSet rs = meta.getImportedKeys(connection.getCatalog(), schema, name)) {
                        while (rs.next()) {
                            String parent = rs.getString("PKTABLE_NAME").toLowerCase(Locale.ROOT);
                            if (!parent.equals(table)) refs.add(parent);
                        }
                    }
                }
                parents.put(table, refs);
            }
            List<String> ordered = new ArrayList<>();
            Set<String> done = new LinkedHashSet<>();
            for (String t : tables.stream().sorted().toList()) visit(t, parents, done, ordered, new LinkedHashSet<>());
            return ordered;
        } catch (SQLException e) {
            throw new IllegalStateException("Lecture du schéma impossible : " + e.getMessage(), e);
        }
    }

    private static void visit(String table, Map<String, Set<String>> parents, Set<String> done, List<String> ordered, Set<String> path) {
        if (done.contains(table) || !path.add(table)) return;
        for (String parent : parents.getOrDefault(table, Set.of())) {
            if (parents.containsKey(parent)) visit(parent, parents, done, ordered, path);
        }
        done.add(table);
        ordered.add(table);
    }

    private void prune() throws IOException {
        List<BackupInfo> all = list();
        for (int i = keep; i < all.size(); i++) Files.deleteIfExists(dir.resolve(all.get(i).name()));
    }

    private Path resolve(String name) {
        if (!name.matches(PREFIX + "[0-9_-]+\\.zip")) throw new IllegalArgumentException("Nom de sauvegarde invalide");
        Path file = dir.resolve(name).normalize();
        if (!file.startsWith(dir) || !Files.exists(file)) throw new smartshop.exception.ResourceNotFoundException("Sauvegarde introuvable");
        return file;
    }

    // Noms lus dans le schéma lui-même : on les valide strictement au lieu de les citer
    // (sans guillemets, PostgreSQL et H2 ignorent la casse)
    private static String quote(String identifier) {
        if (!identifier.matches("[a-z0-9_]+")) throw new IllegalArgumentException("Nom invalide : " + identifier);
        return identifier;
    }
}
