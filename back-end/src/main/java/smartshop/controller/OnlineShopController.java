package smartshop.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.QuoteConvertRequest;
import smartshop.dto.SaleResponse;
import smartshop.entity.OnlineOrder;
import smartshop.service.OnlineShopService;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Boutique en ligne : page et API publiques (sans connexion), puis gestion des commandes dans l'application. */
@RestController
public class OnlineShopController {

    public record StatusRequest(@NotNull OnlineOrder.Status status) {
    }

    private final OnlineShopService service;

    public OnlineShopController(OnlineShopService service) {
        this.service = service;
    }

    // ---------------------------------------------------------------- Public

    /** Page web de la boutique, à partager avec les clients (WhatsApp, Instagram, Facebook…). */
    @GetMapping(value = {"/shop", "/shop/"}, produces = MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
    public ResponseEntity<String> page() throws IOException {
        String html = new ClassPathResource("shop/index.html").getContentAsString(StandardCharsets.UTF_8);
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(html);
    }

    @GetMapping("/api/public/catalog")
    public OnlineShopService.Catalog catalog() {
        return service.catalog();
    }

    @PostMapping("/api/public/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public OnlineShopService.OrderPlaced order(@Valid @RequestBody OnlineShopService.OrderRequest request, HttpServletRequest http) {
        return service.place(request, http.getRemoteAddr());
    }

    // ---------------------------------------------------------------- Boutique (droit SALES)

    @GetMapping("/api/online-orders")
    public List<OnlineShopService.OrderResponse> list(@RequestParam(required = false) OnlineOrder.Status status) {
        return service.list(status);
    }

    @GetMapping("/api/online-orders/pending-count")
    public Map<String, Long> pending() {
        return Map.of("count", service.pendingCount());
    }

    @PutMapping("/api/online-orders/{id}/status")
    public OnlineShopService.OrderResponse status(@PathVariable UUID id, @Valid @RequestBody StatusRequest request) {
        return service.setStatus(id, request.status());
    }

    @PostMapping("/api/online-orders/{id}/convert")
    @ResponseStatus(HttpStatus.CREATED)
    public SaleResponse convert(@PathVariable UUID id, @Valid @RequestBody(required = false) QuoteConvertRequest request) {
        return SaleResponse.from(service.convert(id, request != null ? request.amountPaid() : null));
    }
}
