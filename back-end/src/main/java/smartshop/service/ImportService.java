package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.entity.Customer;
import smartshop.entity.Product;
import smartshop.repository.CustomerRepository;
import smartshop.repository.ProductRepository;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Import de produits et de clients depuis un fichier CSV (export "CSV" d'Excel ou de Google Sheets).
 * Séparateur ; ou , détecté automatiquement. La première ligne contient les noms de colonnes.
 * Les produits existants (même référence) sont mis à jour ; leur stock n'est pas modifié.
 */
@Service
public class ImportService {

    public record ImportError(int line, String message) {
    }

    public record ImportResult(int created, int updated, List<ImportError> errors) {
    }

    public static final String PRODUCTS_TEMPLATE =
            "reference;nom;prix_vente;prix_achat;stock;code_barres;marque;modele;seuil_alerte\n"
                    + "IP15-128;iPhone 15 128 Go;9990;8500;3;0194253401234;Apple;iPhone 15;1\n";

    public static final String CUSTOMERS_TEMPLATE =
            "nom;telephone;adresse;ice;plafond_credit\n"
                    + "Karim Alaoui;0661223344;12 rue Atlas, Rabat;;2000\n";

    private final ProductRepository productRepository;
    private final CustomerRepository customerRepository;

    public ImportService(ProductRepository productRepository, CustomerRepository customerRepository) {
        this.productRepository = productRepository;
        this.customerRepository = customerRepository;
    }

    @Transactional
    public ImportResult importProducts(String csv) {
        Table table = parse(csv);
        int created = 0;
        int updated = 0;
        List<ImportError> errors = new ArrayList<>();

        for (int i = 0; i < table.rows().size(); i++) {
            Map<String, String> row = table.rows().get(i);
            int lineNumber = i + 2;
            try {
                // Contrôles faits avant l'écriture : une erreur SQL annulerait tout l'import
                String reference = maxLength(required(row, "reference"), 50, "reference");
                String name = maxLength(required(row, "nom"), 150, "nom");
                BigDecimal salePrice = decimal(row, "prix_vente", true);
                Product product = productRepository.findByReference(reference).orElse(null);
                boolean isNew = product == null;
                if (isNew) {
                    product = new Product();
                    product.setReference(reference);
                    BigDecimal cost = decimal(row, "prix_achat", false);
                    if (cost != null) product.setAveragePurchasePrice(cost);
                    BigDecimal stock = decimal(row, "stock", false);
                    if (stock != null) product.setStockQuantity(stock.intValueExact());
                }
                product.setName(name);
                product.setSalePrice(salePrice);
                String barcode = blankToNull(row.get("code_barres"));
                if (barcode != null) {
                    maxLength(barcode, 64, "code_barres");
                    Product other = productRepository.findByBarcode(barcode).orElse(null);
                    if (other != null && other != product) throw new IllegalArgumentException("code-barres déjà utilisé par " + other.getName());
                    product.setBarcode(barcode);
                }
                if (row.containsKey("marque")) product.setBrand(blankToNull(row.get("marque")));
                if (row.containsKey("modele")) product.setModel(blankToNull(row.get("modele")));
                BigDecimal threshold = decimal(row, "seuil_alerte", false);
                if (threshold != null) product.setAlertThreshold(threshold.intValueExact());
                productRepository.saveAndFlush(product);
                if (isNew) created++;
                else updated++;
            } catch (RuntimeException e) {
                errors.add(new ImportError(lineNumber, message(e)));
            }
        }
        return new ImportResult(created, updated, errors);
    }

    @Transactional
    public ImportResult importCustomers(String csv) {
        Table table = parse(csv);
        int created = 0;
        List<ImportError> errors = new ArrayList<>();
        for (int i = 0; i < table.rows().size(); i++) {
            Map<String, String> row = table.rows().get(i);
            try {
                Customer c = new Customer();
                c.setName(maxLength(required(row, "nom"), 150, "nom"));
                String phone = blankToNull(row.get("telephone"));
                c.setPhone(phone == null ? null : maxLength(phone, 30, "telephone"));
                String address = blankToNull(row.get("adresse"));
                c.setAddress(address == null ? null : maxLength(address, 255, "adresse"));
                String ice = blankToNull(row.get("ice"));
                if (ice != null && !ice.matches("\\d{15}")) throw new IllegalArgumentException("ICE invalide (15 chiffres)");
                c.setIce(ice);
                c.setCreditLimit(decimal(row, "plafond_credit", false));
                customerRepository.save(c);
                created++;
            } catch (RuntimeException e) {
                errors.add(new ImportError(i + 2, message(e)));
            }
        }
        return new ImportResult(created, 0, errors);
    }

    // ---------------------------------------------------------------- Lecture du CSV

    private record Table(List<String> headers, List<Map<String, String>> rows) {
    }

    private Table parse(String csv) {
        if (csv == null || csv.isBlank()) throw new IllegalArgumentException("Le fichier est vide");
        String text = csv.startsWith("﻿") ? csv.substring(1) : csv; // BOM d'Excel
        List<String> lines = text.lines().filter(l -> !l.isBlank()).toList();
        if (lines.size() < 2) throw new IllegalArgumentException("Le fichier ne contient aucune ligne de données");
        if (lines.size() > 5001) throw new IllegalArgumentException("5000 lignes maximum par import");

        String first = lines.get(0);
        char separator = first.chars().filter(ch -> ch == ';').count() >= first.chars().filter(ch -> ch == ',').count() ? ';' : ',';
        List<String> headers = split(first, separator).stream().map(ImportService::normalizeHeader).toList();

        List<Map<String, String>> rows = new ArrayList<>();
        for (String line : lines.subList(1, lines.size())) {
            List<String> cells = split(line, separator);
            Map<String, String> row = new HashMap<>();
            for (int c = 0; c < headers.size() && c < cells.size(); c++) row.put(headers.get(c), cells.get(c).trim());
            rows.add(row);
        }
        return new Table(headers, rows);
    }

    /** Découpe une ligne CSV en respectant les guillemets ("a;b" reste une seule cellule). */
    static List<String> split(String line, char separator) {
        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == separator && !quoted) {
                cells.add(current.toString());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        cells.add(current.toString());
        return cells;
    }

    /** "Prix vente" / "prix_vente" / "PRIX-VENTE" -> "prix_vente" */
    private static String normalizeHeader(String header) {
        String noAccents = Normalizer.normalize(header.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return noAccents.replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
    }

    private static String required(Map<String, String> row, String column) {
        String value = blankToNull(row.get(column));
        if (value == null) throw new IllegalArgumentException("colonne \"" + column + "\" vide");
        return value;
    }

    private static BigDecimal decimal(Map<String, String> row, String column, boolean required) {
        String value = blankToNull(row.get(column));
        if (value == null) {
            if (required) throw new IllegalArgumentException("colonne \"" + column + "\" vide");
            return null;
        }
        try {
            BigDecimal number = new BigDecimal(value.replace(" ", "").replace(" ", "").replace(',', '.'));
            if (number.signum() < 0) throw new IllegalArgumentException("\"" + column + "\" négatif");
            return number;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("\"" + column + "\" n'est pas un nombre : " + value);
        }
    }

    private static String maxLength(String value, int max, String column) {
        if (value.length() > max) throw new IllegalArgumentException("\"" + column + "\" trop long (" + max + " caractères maximum)");
        return value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String message(RuntimeException e) {
        if (e instanceof ArithmeticException) return "nombre entier attendu";
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }
}
