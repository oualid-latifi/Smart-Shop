package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.CheckResponse;
import smartshop.entity.CheckStatus;
import smartshop.entity.CustomerPayment;
import smartshop.entity.Sale;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.CustomerPaymentRepository;
import smartshop.repository.SaleRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Suivi des chèques reçus : à encaisser, encaissés, impayés. */
@Service
public class CheckService {

    private final CustomerPaymentRepository paymentRepository;
    private final SaleRepository saleRepository;

    public CheckService(CustomerPaymentRepository paymentRepository, SaleRepository saleRepository) {
        this.paymentRepository = paymentRepository;
        this.saleRepository = saleRepository;
    }

    @Transactional(readOnly = true)
    public List<CheckResponse> findAll(CheckStatus status) {
        // Un chèque réparti sur plusieurs ventes = plusieurs lignes de paiement avec le même operationId
        Map<UUID, List<CustomerPayment>> grouped = new LinkedHashMap<>();
        for (CustomerPayment p : paymentRepository.findChecks(status)) {
            UUID key = p.getOperationId() != null ? p.getOperationId() : p.getId();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
        }
        return grouped.values().stream().map(CheckResponse::from).toList();
    }

    @Transactional
    public CheckResponse markCashed(UUID operationId) {
        List<CustomerPayment> parts = parts(operationId);
        for (CustomerPayment p : parts) {
            if (p.getCheckStatus() == CheckStatus.BOUNCED) {
                throw new IllegalArgumentException("Ce chèque est marqué impayé");
            }
            p.setCheckStatus(CheckStatus.CASHED);
            p.setCheckStatusAt(LocalDateTime.now());
        }
        paymentRepository.saveAll(parts);
        return CheckResponse.from(parts);
    }

    /** Chèque impayé : le montant est retiré des ventes payées, la dette du client revient. */
    @Transactional
    public CheckResponse markBounced(UUID operationId) {
        List<CustomerPayment> parts = parts(operationId);
        for (CustomerPayment p : parts) {
            if (p.getCheckStatus() == CheckStatus.BOUNCED) {
                throw new IllegalArgumentException("Ce chèque est déjà marqué impayé");
            }
            Sale sale = p.getSale();
            sale.setAmountPaid(sale.getAmountPaid().subtract(p.getAmount()));
            saleRepository.save(sale);
            p.setCheckStatus(CheckStatus.BOUNCED);
            p.setCheckStatusAt(LocalDateTime.now());
        }
        paymentRepository.saveAll(parts);
        return CheckResponse.from(parts);
    }

    private List<CustomerPayment> parts(UUID operationId) {
        List<CustomerPayment> parts = paymentRepository.findByOperationId(operationId);
        if (parts.isEmpty()) {
            // Paiement sans operationId (ancien) : identifiant direct
            parts = paymentRepository.findById(operationId).map(List::of).orElse(List.of());
        }
        if (parts.isEmpty() || parts.get(0).getCheckStatus() == null) {
            throw new ResourceNotFoundException("Chèque introuvable");
        }
        return new ArrayList<>(parts);
    }
}
