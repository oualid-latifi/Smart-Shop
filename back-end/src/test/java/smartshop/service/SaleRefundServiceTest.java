package smartshop.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import smartshop.dto.RefundRequest;
import smartshop.entity.Sale;
import smartshop.entity.SaleRefund;
import smartshop.repository.SaleRefundRepository;
import smartshop.repository.SaleRepository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SaleRefundServiceTest {

    @Mock
    private SaleRepository sales;
    @Mock
    private SaleRefundRepository refunds;

    @Test
    void refundCannotExceedAmountPaidAfterPreviousRefunds() {
        UUID saleId = UUID.randomUUID();
        Sale sale = new Sale();
        sale.setTotal(new BigDecimal("100.00"));
        sale.setAmountPaid(new BigDecimal("60.00"));
        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));
        when(refunds.sumBySaleId(saleId)).thenReturn(new BigDecimal("20.00"));

        SaleRefundService service = new SaleRefundService(sales, refunds);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.refund(saleId, new RefundRequest(new BigDecimal("40.01"), "Retour")));

        assertTrue(error.getMessage().contains("20.00"));
        verify(refunds, never()).save(any(SaleRefund.class));
    }

    @Test
    void refundAcceptsRemainingPaidAmountAndTrimsReason() {
        UUID saleId = UUID.randomUUID();
        Sale sale = new Sale();
        sale.setTotal(new BigDecimal("100.00"));
        sale.setAmountPaid(new BigDecimal("60.00"));
        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));
        when(refunds.sumBySaleId(saleId)).thenReturn(new BigDecimal("20.00"));
        when(refunds.save(any(SaleRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SaleRefundService service = new SaleRefundService(sales, refunds);
        SaleRefund result = service.refund(saleId, new RefundRequest(new BigDecimal("40.00"), "  Retour client  "));

        assertEquals(new BigDecimal("40.00"), result.getAmount());
        assertEquals("Retour client", result.getReason());
        assertSame(sale, result.getSale());
        verify(refunds).save(any(SaleRefund.class));
    }

    @Test
    void refundFailsWhenSaleDoesNotExist() {
        UUID saleId = UUID.randomUUID();
        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.empty());

        SaleRefundService service = new SaleRefundService(sales, refunds);

        assertThrows(IllegalArgumentException.class,
                () -> service.refund(saleId, new RefundRequest(new BigDecimal("1.00"), "Retour")));
        verifyNoInteractions(refunds);
    }
}
