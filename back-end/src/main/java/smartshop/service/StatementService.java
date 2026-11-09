package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.AgingResponse;
import smartshop.dto.StatementResponse;
import smartshop.dto.StatementResponse.Entry;
import smartshop.dto.StatementResponse.EntryType;
import smartshop.entity.CheckStatus;
import smartshop.entity.Customer;
import smartshop.entity.CustomerPayment;
import smartshop.entity.PaymentMethod;
import smartshop.entity.Sale;
import smartshop.entity.SaleReturn;
import smartshop.entity.SaleStatus;
import smartshop.exception.ResourceNotFoundException;
import smartshop.repository.CustomerPaymentRepository;
import smartshop.repository.CustomerRepository;
import smartshop.repository.SaleRepository;
import smartshop.repository.SaleReturnRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Relevé de compte client et ancienneté des créances. */
@Service
public class StatementService {

    private final CustomerRepository customerRepository;
    private final SaleRepository saleRepository;
    private final CustomerPaymentRepository paymentRepository;
    private final SaleReturnRepository returnRepository;

    public StatementService(CustomerRepository customerRepository,
                            SaleRepository saleRepository,
                            CustomerPaymentRepository paymentRepository,
                            SaleReturnRepository returnRepository) {
        this.customerRepository = customerRepository;
        this.saleRepository = saleRepository;
        this.paymentRepository = paymentRepository;
        this.returnRepository = returnRepository;
    }

    private record Movement(LocalDateTime date, EntryType type, String reference, String label, BigDecimal debit, BigDecimal credit) {
    }

    /** Sans dates : tout l'historique jusqu'à aujourd'hui. */
    @Transactional(readOnly = true)
    public StatementResponse statement(UUID customerId, LocalDate from, LocalDate to) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Client introuvable"));
        LocalDate end = to != null ? to : LocalDate.now();
        if (from != null && from.isAfter(end)) {
            throw new IllegalArgumentException("La date de début doit être avant la date de fin");
        }

        List<Movement> movements = new ArrayList<>();
        for (Sale sale : saleRepository.findByCustomer_IdOrderBySaleDateDesc(customerId)) {
            if (sale.getStatus() != SaleStatus.VALIDATED) continue;
            movements.add(new Movement(sale.getSaleDate(), EntryType.SALE, sale.getDisplayNumber(),
                    "Vente " + sale.getDisplayNumber(), sale.getTotal(), BigDecimal.ZERO));
        }
        for (CustomerPayment p : paymentRepository.findByCustomer_IdOrderByPaidAtAsc(customerId)) {
            if (p.getSale().getStatus() != SaleStatus.VALIDATED) continue;
            String label = switch (p.getMethod()) {
                case CHECK -> "Chèque n° " + p.getCheckNumber();
                case TRANSFER -> "Virement";
                case CARD -> "Carte bancaire";
                default -> "Paiement espèces";
            };
            movements.add(new Movement(p.getPaidAt(), EntryType.PAYMENT, p.getSale().getDisplayNumber(), label, BigDecimal.ZERO, p.getAmount()));
            if (p.getMethod() == PaymentMethod.CHECK && p.getCheckStatus() == CheckStatus.BOUNCED) {
                movements.add(new Movement(p.getCheckStatusAt(), EntryType.CHECK_BOUNCED, p.getSale().getDisplayNumber(),
                        "Chèque impayé n° " + p.getCheckNumber(), p.getAmount(), BigDecimal.ZERO));
            }
        }
        for (SaleReturn r : returnRepository.findBySale_Customer_IdOrderByReturnedAtAsc(customerId)) {
            if (r.getSale().getStatus() != SaleStatus.VALIDATED) continue;
            String ref = r.getSale().getDisplayNumber();
            movements.add(new Movement(r.getReturnedAt(), EntryType.RETURN, ref, "Retour d'articles", BigDecimal.ZERO, r.getCreditAmount()));
            if (r.getRefundAmount().signum() > 0) {
                movements.add(new Movement(r.getReturnedAt(), EntryType.REFUND, ref, "Remboursement", r.getRefundAmount(), BigDecimal.ZERO));
            }
        }
        movements.sort(Comparator.comparing(Movement::date));

        LocalDateTime startTime = from != null ? from.atStartOfDay() : LocalDateTime.MIN;
        LocalDateTime endTime = end.plusDays(1).atStartOfDay();
        BigDecimal opening = BigDecimal.ZERO;
        BigDecimal balance;
        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;
        List<Entry> entries = new ArrayList<>();

        for (Movement m : movements) {
            if (m.date().isBefore(startTime)) {
                opening = opening.add(m.debit()).subtract(m.credit());
            }
        }
        balance = opening;
        for (Movement m : movements) {
            if (m.date().isBefore(startTime) || !m.date().isBefore(endTime)) continue;
            balance = balance.add(m.debit()).subtract(m.credit());
            totalDebit = totalDebit.add(m.debit());
            totalCredit = totalCredit.add(m.credit());
            entries.add(new Entry(m.date(), m.type(), m.reference(), m.label(), m.debit(), m.credit(), balance));
        }

        return new StatementResponse(customer.getId(), customer.getName(), customer.getPhone(), customer.getAddress(),
                customer.getIce(), from, end, opening, totalDebit, totalCredit, balance, entries);
    }

    /** Ancienneté des créances de tous les clients qui doivent de l'argent, les plus anciennes d'abord. */
    @Transactional(readOnly = true)
    public List<AgingResponse> aging() {
        LocalDate today = LocalDate.now();
        List<AgingResponse> result = new ArrayList<>();
        saleRepository.findDebtors().forEach(debtor -> {
            BigDecimal[] buckets = {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO};
            int oldest = 0;
            BigDecimal total = BigDecimal.ZERO;
            for (Sale sale : saleRepository.findUnpaidByCustomer(debtor.getCustomerId())) {
                int days = (int) ChronoUnit.DAYS.between(sale.getSaleDate().toLocalDate(), today);
                int bucket = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
                buckets[bucket] = buckets[bucket].add(sale.getRemaining());
                total = total.add(sale.getRemaining());
                oldest = Math.max(oldest, days);
            }
            result.add(new AgingResponse(debtor.getCustomerId(), debtor.getName(), debtor.getPhone(), total,
                    buckets[0], buckets[1], buckets[2], buckets[3], oldest));
        });
        result.sort(Comparator.comparingInt(AgingResponse::oldestDays).reversed());
        return result;
    }
}
