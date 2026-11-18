package smartshop.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import smartshop.service.ShopService;

/** Boutique du compte connecté (nom, adresse de la boutique en ligne). */
@RestController
public class ShopController {

    private final ShopService shopService;

    public ShopController(ShopService shopService) {
        this.shopService = shopService;
    }

    @GetMapping("/api/shop")
    public ShopService.ShopInfo current() {
        return shopService.current();
    }
}
