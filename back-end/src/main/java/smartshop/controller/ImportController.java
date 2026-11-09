package smartshop.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import smartshop.service.ImportService;
import smartshop.service.ImportService.ImportResult;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/import")
public class ImportController {

    /** Contenu du fichier CSV, lu par l'application (2 Mo maximum). */
    public record CsvRequest(@NotBlank @Size(max = 2_000_000) String csv) {
    }

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @PostMapping("/products")
    public ImportResult importProducts(@Valid @RequestBody CsvRequest request) {
        return importService.importProducts(request.csv());
    }

    @PostMapping("/customers")
    public ImportResult importCustomers(@Valid @RequestBody CsvRequest request) {
        return importService.importCustomers(request.csv());
    }

    // Modèles à remplir dans Excel : "products" ou "customers"
    @GetMapping("/templates/{type}.csv")
    public ResponseEntity<byte[]> template(@PathVariable String type) {
        String content = switch (type) {
            case "products" -> ImportService.PRODUCTS_TEMPLATE;
            case "customers" -> ImportService.CUSTOMERS_TEMPLATE;
            default -> throw new IllegalArgumentException("Modèle inconnu : " + type);
        };
        // BOM UTF-8 : Excel affiche correctement les accents
        byte[] bytes = ("﻿" + content).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"modele-" + type + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(bytes);
    }
}
