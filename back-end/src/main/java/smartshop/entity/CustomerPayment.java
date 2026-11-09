package smartshop.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "customer_payments")
public class CustomerPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "paid_at", nullable = false)
    private LocalDateTime paidAt;

    // Null pour les anciens paiements = espèces
    @Enumerated(EnumType.STRING)
    @Column(length = 15)
    private PaymentMethod method;

    // Informations du chèque
    @Column(name = "check_number", length = 40)
    private String checkNumber;

    @Column(name = "check_bank", length = 80)
    private String checkBank;

    @Column(name = "check_due_date")
    private java.time.LocalDate checkDueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "check_status", length = 15)
    private CheckStatus checkStatus;

    @Column(name = "check_status_at")
    private LocalDateTime checkStatusAt;

    // Un même règlement (ex : un chèque) peut être réparti sur plusieurs ventes : même operationId
    @Column(name = "operation_id")
    private UUID operationId;

    // Employé qui a reçu l'argent (sert aux remises de caisse)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collected_by")
    private AppUser collectedBy;

    public CustomerPayment() {
    }

    @PrePersist
    void onCreate() {
        this.paidAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }

    public Sale getSale() { return sale; }
    public void setSale(Sale sale) { this.sale = sale; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public LocalDateTime getPaidAt() { return paidAt; }

    public PaymentMethod getMethod() { return method != null ? method : PaymentMethod.CASH; }
    public void setMethod(PaymentMethod method) { this.method = method; }

    public String getCheckNumber() { return checkNumber; }
    public void setCheckNumber(String checkNumber) { this.checkNumber = checkNumber; }

    public String getCheckBank() { return checkBank; }
    public void setCheckBank(String checkBank) { this.checkBank = checkBank; }

    public java.time.LocalDate getCheckDueDate() { return checkDueDate; }
    public void setCheckDueDate(java.time.LocalDate checkDueDate) { this.checkDueDate = checkDueDate; }

    public CheckStatus getCheckStatus() { return checkStatus; }
    public void setCheckStatus(CheckStatus checkStatus) { this.checkStatus = checkStatus; }

    public AppUser getCollectedBy() { return collectedBy; }
    public void setCollectedBy(AppUser collectedBy) { this.collectedBy = collectedBy; }

    public UUID getOperationId() { return operationId; }
    public void setOperationId(UUID operationId) { this.operationId = operationId; }

    public LocalDateTime getCheckStatusAt() { return checkStatusAt; }
    public void setCheckStatusAt(LocalDateTime checkStatusAt) { this.checkStatusAt = checkStatusAt; }
}
