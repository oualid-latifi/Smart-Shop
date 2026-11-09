package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.InventoryDtos.CountRequest;
import smartshop.dto.InventoryDtos.InventoryResponse;
import smartshop.dto.InventoryDtos.OpenRequest;
import smartshop.service.InventoryService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventories")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryResponse open(@Valid @RequestBody(required = false) OpenRequest request) {
        return InventoryResponse.from(inventoryService.open(request != null ? request : new OpenRequest(null, null)), true);
    }

    @GetMapping
    public List<InventoryResponse> findAll() {
        return inventoryService.findAll().stream().map(i -> InventoryResponse.from(i, false)).toList();
    }

    @GetMapping("/{id}")
    public InventoryResponse findById(@PathVariable UUID id) {
        return InventoryResponse.from(inventoryService.findById(id), true);
    }

    // Enregistre une ou plusieurs quantités comptées (peut être appelé plusieurs fois pendant le comptage)
    @PutMapping("/{id}/counts")
    public InventoryResponse saveCounts(@PathVariable UUID id, @Valid @RequestBody CountRequest request) {
        return InventoryResponse.from(inventoryService.saveCounts(id, request.counts()), true);
    }

    @PostMapping("/{id}/close")
    public InventoryResponse close(@PathVariable UUID id) {
        return InventoryResponse.from(inventoryService.close(id), true);
    }

    @PostMapping("/{id}/cancel")
    public InventoryResponse cancel(@PathVariable UUID id) {
        return InventoryResponse.from(inventoryService.cancel(id), true);
    }
}
