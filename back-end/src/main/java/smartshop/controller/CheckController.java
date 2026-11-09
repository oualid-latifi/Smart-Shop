package smartshop.controller;

import org.springframework.web.bind.annotation.*;
import smartshop.dto.CheckResponse;
import smartshop.entity.CheckStatus;
import smartshop.service.CheckService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/checks")
public class CheckController {

    private final CheckService checkService;

    public CheckController(CheckService checkService) {
        this.checkService = checkService;
    }

    // ?status=PENDING pour les chèques à encaisser (triés par échéance)
    @GetMapping
    public List<CheckResponse> findAll(@RequestParam(required = false) CheckStatus status) {
        return checkService.findAll(status);
    }

    @PostMapping("/{operationId}/cashed")
    public CheckResponse markCashed(@PathVariable UUID operationId) {
        return checkService.markCashed(operationId);
    }

    @PostMapping("/{operationId}/bounced")
    public CheckResponse markBounced(@PathVariable UUID operationId) {
        return checkService.markBounced(operationId);
    }
}
