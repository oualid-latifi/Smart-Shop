package smartshop.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Relevé de compte d'un client : mouvements de la période avec solde progressif. */
public record StatementResponse(
        UUID customerId,
        String customerName,
        String customerPhone,
        String customerAddress,
        String customerIce,
        LocalDate from,
        LocalDate to,
        BigDecimal openingBalance,
        BigDecimal totalDebit,
        BigDecimal totalCredit,
        BigDecimal closingBalance,
        List<Entry> entries
) {

    public enum EntryType { SALE, PAYMENT, CHECK_BOUNCED, RETURN, REFUND }

    /** debit = ce que le client doit en plus ; credit = ce qui réduit sa dette. */
    public record Entry(LocalDateTime date, EntryType type, String reference, String label,
                        BigDecimal debit, BigDecimal credit, BigDecimal balance) {
    }
}
