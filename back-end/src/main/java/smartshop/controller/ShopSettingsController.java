package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.ShopSettingsDto;
import smartshop.service.ShopSettingsService;

@RestController
@RequestMapping("/api/settings")
public class ShopSettingsController {

    private final ShopSettingsService service;

    public ShopSettingsController(ShopSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public ShopSettingsDto get() {
        return ShopSettingsDto.from(service.get());
    }

    @PutMapping
    public ShopSettingsDto update(@Valid @RequestBody ShopSettingsDto request) {
        return ShopSettingsDto.from(service.update(request));
    }
}
