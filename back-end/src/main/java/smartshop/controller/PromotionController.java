package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.service.PromotionService;
import smartshop.service.PromotionService.PromotionRequest;
import smartshop.service.PromotionService.PromotionResponse;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/promotions")
public class PromotionController {

    private final PromotionService promotionService;

    public PromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    @GetMapping
    public List<PromotionResponse> findAll() {
        return promotionService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PromotionResponse create(@Valid @RequestBody PromotionRequest request) {
        return promotionService.save(null, request);
    }

    @PutMapping("/{id}")
    public PromotionResponse update(@PathVariable UUID id, @Valid @RequestBody PromotionRequest request) {
        return promotionService.save(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        promotionService.delete(id);
    }
}
