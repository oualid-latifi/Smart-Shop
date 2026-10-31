package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.RefundRequest;
import smartshop.entity.Sale;
import smartshop.entity.SaleRefund;
import smartshop.repository.SaleRefundRepository;
import smartshop.repository.SaleRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class SaleRefundService {
    private final SaleRepository saleRepository;
    private final SaleRefundRepository refundRepository;

    public SaleRefundService(SaleRepository saleRepository, SaleRefundRepository refundRepository) {
        this.saleRepository = saleRepository;
        this.refundRepository = refundRepository;
    }

    @Transactional
    public SaleRefund refund(UUID saleId, RefundRequest request) {
        Sale sale = saleRepository.findByIdForUpdate(saleId)
                .orElseThrow(() -> new IllegalArgumentException("Vente introuvable"));
        BigDecimal alreadyRefunded = refundRepository.sumBySaleId(saleId);
        if (alreadyRefunded == null) alreadyRefunded = BigDecimal.ZERO;
        BigDecimal refundable = sale.getAmountPaid().subtract(alreadyRefunded);
        if (request.amount().compareTo(refundable) > 0) {
            throw new IllegalArgumentException("Le remboursement dépasse le montant réellement encaissé restant (" + refundable + " DH)");
        }
        SaleRefund refund = new SaleRefund();
        refund.setSale(sale);
        refund.setAmount(request.amount());
        refund.setReason(request.reason().trim());
        return refundRepository.save(refund);
    }

    @Transactional(readOnly = true)
    public List<SaleRefund> getRefundHistory(UUID saleId) {
        if (!saleRepository.existsById(saleId)) {
            throw new IllegalArgumentException("Vente introuvable");
        }
        return refundRepository.findAllBySaleIdOrderByRefundedAtDesc(saleId);
    }
}
