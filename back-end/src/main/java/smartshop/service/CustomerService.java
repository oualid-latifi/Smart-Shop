package smartshop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import smartshop.dto.CustomerDebtResponse;
import smartshop.dto.CustomerRequest;
import smartshop.dto.CustomerResponse;
import smartshop.dto.SaleResponse;
import smartshop.entity.Customer;
import smartshop.entity.CustomerPayment;
import smartshop.entity.Sale;
import smartshop.repository.CustomerPaymentRepository;
import smartshop.repository.CustomerRepository;
import smartshop.repository.SaleRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final CustomerPaymentRepository paymentRepository;
    private final SaleRepository saleRepository;


    public CustomerService(CustomerRepository customerRepository,
                           CustomerPaymentRepository paymentRepository,
                           SaleRepository saleRepository) {
        this.customerRepository = customerRepository;
        this.paymentRepository = paymentRepository;
        this.saleRepository = saleRepository;
    }

    @Transactional
    public CustomerResponse create(CustomerRequest request) {
        Customer customer = new Customer();
        customer.setId(request.id());
        customer.setName(request.name());
        customer.setPhone(request.phone());
        customer.setCreditLimit(request.creditLimit());
        Customer saved = customerRepository.save(customer);
        return CustomerResponse.from(saved, BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> findAll() {
        return customerRepository.findAll().stream()
                .map(c -> CustomerResponse.from(c, balanceOf(c.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public CustomerResponse findById(UUID id) {
        Customer customer = getCustomer(id);
        return CustomerResponse.from(customer, balanceOf(id));
    }

    @Transactional
    public CustomerResponse update(UUID id, CustomerRequest request) {
        Customer customer = getCustomer(id);
        customer.setName(request.name());
        customer.setPhone(request.phone());
        customer.setCreditLimit(request.creditLimit());
        Customer saved = customerRepository.save(customer);
        return CustomerResponse.from(saved, balanceOf(id));
    }

    @Transactional(readOnly = true)
    public List<SaleResponse> findSales(UUID customerId) {
        getCustomer(customerId);
        return saleRepository.findByCustomer_IdOrderBySaleDateDesc(customerId).stream()
                .map(SaleResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CustomerDebtResponse> findDebtors() {
        return saleRepository.findDebtors().stream()
                .map(CustomerDebtResponse::from)
                .toList();
    }

    /**
     * Le client rembourse une partie (ou la totalité) de son kridi.
     * Le montant est appliqué d'abord à sa plus ancienne dette.
     */
    @Transactional
    public CustomerResponse pay(UUID customerId, smartshop.dto.PaymentRequest request) {
        Customer customer = customerRepository.findByIdForUpdate(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Client introuvable"));

        // A retry after a lost HTTP response must not apply the same payment twice.
        UUID requestId = request.id() != null ? request.id() : UUID.randomUUID();
        if (paymentRepository.existsByPaymentRequestId(requestId)) {
            return CustomerResponse.from(customer, balanceOf(customerId));
        }
        BigDecimal amount = request.amount();
        List<Sale> unpaidSales = saleRepository.findUnpaidByCustomer(customerId);

        if (unpaidSales.isEmpty()) {
            throw new IllegalArgumentException("Ce client n'a pas de dette");
        }

        BigDecimal debt = balanceOf(customerId);
        if (amount.compareTo(debt) > 0) {
            throw new IllegalArgumentException(
                    "Le paiement dépasse la dette du client (" + debt + " DH)");
        }

        BigDecimal left = amount;
        for (Sale sale : unpaidSales) {
            if (left.signum() <= 0) {
                break;
            }
            BigDecimal part = left.min(sale.getRemaining());

            sale.setAmountPaid(sale.getAmountPaid().add(part));
            saleRepository.save(sale);

            CustomerPayment payment = new CustomerPayment();
            payment.setPaymentRequestId(requestId);
            payment.setCustomer(customer);
            payment.setSale(sale);
            payment.setAmount(part);
            if (request.paidAt() != null) payment.setPaidAt(request.paidAt());
            paymentRepository.save(payment);

            left = left.subtract(part);
        }

        return CustomerResponse.from(customer, balanceOf(customerId));
    }

    @Transactional
    public void delete(UUID customerId) {
        Customer customer = customerRepository.findByIdForUpdate(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Client introuvable"));
        if (saleRepository.existsByCustomer_Id(customerId)) {
            throw new IllegalArgumentException(
                    "Impossible de supprimer ce client : il possède un historique de ventes");
        }
        customerRepository.delete(customer);
    }

    private BigDecimal balanceOf(UUID customerId) {
        BigDecimal balance = saleRepository.sumDebtByCustomer(customerId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    private Customer getCustomer(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Client introuvable"));
    }
}
