package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.ShopSettingsDto;
import smartshop.service.ShopSettingsService;

@RestController
@RequestMapping("/api/settings")
public class ShopSettingsController {

    private final ShopSettingsService service;
    private final smartshop.service.ApprovalService approvalService;

    public ShopSettingsController(ShopSettingsService service, smartshop.service.ApprovalService approvalService) {
        this.service = service;
        this.approvalService = approvalService;
    }

    @GetMapping
    public ShopSettingsDto get() {
        return ShopSettingsDto.from(service.get());
    }

    public record PinRequest(@jakarta.validation.constraints.Pattern(regexp = "^$|^\\d{4,8}$", message = "Le code contient 4 à 8 chiffres") String pin) {
    }

    // Code PIN du propriétaire pour valider les grosses remises et les annulations (vide = supprimer)
    @PutMapping("/approval-pin")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void setPin(@Valid @RequestBody PinRequest request) {
        approvalService.setPin(request.pin());
    }

    @PutMapping
    public ShopSettingsDto update(@Valid @RequestBody ShopSettingsDto request) {
        return ShopSettingsDto.from(service.update(request));
    }
}
