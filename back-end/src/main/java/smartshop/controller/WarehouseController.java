package smartshop.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import smartshop.dto.WarehouseDtos.ProductLocations;
import smartshop.dto.WarehouseDtos.StockLine;
import smartshop.dto.WarehouseDtos.TransferRequest;
import smartshop.dto.WarehouseDtos.WarehouseRequest;
import smartshop.dto.WarehouseDtos.WarehouseResponse;
import smartshop.service.WarehouseService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/warehouses")
public class WarehouseController {

    private final WarehouseService warehouseService;

    public WarehouseController(WarehouseService warehouseService) {
        this.warehouseService = warehouseService;
    }

    @GetMapping
    public List<WarehouseResponse> findAll() {
        return warehouseService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WarehouseResponse create(@Valid @RequestBody WarehouseRequest request) {
        return warehouseService.create(request);
    }

    @PutMapping("/{id}")
    public WarehouseResponse update(@PathVariable UUID id, @Valid @RequestBody WarehouseRequest request) {
        return warehouseService.update(id, request);
    }

    @GetMapping("/{id}/stock")
    public List<StockLine> stock(@PathVariable UUID id) {
        return warehouseService.stock(id);
    }

    @GetMapping("/locations/{productId}")
    public ProductLocations locations(@PathVariable UUID productId) {
        return warehouseService.locations(productId);
    }

    @PostMapping("/transfers")
    public ProductLocations transfer(@Valid @RequestBody TransferRequest request) {
        return warehouseService.transfer(request);
    }
}
