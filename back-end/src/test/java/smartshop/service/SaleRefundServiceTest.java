package smartshop.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import smartshop.dto.RefundLineRequest;
import smartshop.dto.RefundRequest;
import smartshop.entity.*;
import smartshop.repository.*;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SaleRefundServiceTest {
    @Mock private SaleRepository sales;
    @Mock private SaleRefundRepository refunds;
    @Mock private SaleRefundLineRepository refundLines;
    @Mock private ProductRepository products;
    @Mock private StockMovementRepository stockMovements;

    @Test
    void returnsOnlyRequestedQuantityAndRestoresStock() throws Exception {
        UUID saleId = UUID.randomUUID();
        UUID saleLineId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        setId(product, productId);
        product.setName("Smartphone");
        product.setStockQuantity(3);

        SaleLine saleLine = new SaleLine();
        setId(saleLine, saleLineId);
        saleLine.setProduct(product);
        saleLine.setQuantity(2);
        saleLine.setUnitPrice(new BigDecimal("50.00"));
        saleLine.setUnitCost(new BigDecimal("30.00"));

        Sale sale = new Sale();
        sale.setTotal(new BigDecimal("90.00"));
        sale.setDiscount(new BigDecimal("10.00"));
        sale.setAmountPaid(new BigDecimal("90.00"));
        sale.addLine(saleLine);

        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));
        when(refundLines.sumReturnedQuantityBySaleLineId(saleLineId)).thenReturn(0L);
        when(products.findByIdForUpdate(productId)).thenReturn(Optional.of(product));
        when(refunds.save(any(SaleRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SaleRefundService service = new SaleRefundService(
                sales, refunds, refundLines, products, stockMovements);

        SaleRefund result = service.refund(saleId,
                new RefundRequest(List.of(new RefundLineRequest(saleLineId, 1)), "  Retour client  "));

        assertEquals(new BigDecimal("45.00"), result.getAmount());
        assertEquals(new BigDecimal("0.00"), result.getCreditApplied());
        assertEquals(new BigDecimal("45.00"), result.getCashRefunded());
        assertEquals("Retour client", result.getReason());
        assertEquals(4, product.getStockQuantity());
        assertEquals(1, result.getLines().get(0).getQuantity());
        verify(stockMovements).save(argThat(movement ->
                movement.getType() == StockMovementType.SALE_RETURN
                        && movement.getQuantity() == 1
                        && saleId.equals(movement.getReferenceId())));
    }

    @Test
    void appliesReturnAgainstOutstandingCreditBeforeCash() throws Exception {
        UUID saleId = UUID.randomUUID();
        UUID saleLineId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        setId(product, productId);
        product.setName("Smartphone");
        product.setStockQuantity(1);

        SaleLine saleLine = new SaleLine();
        setId(saleLine, saleLineId);
        saleLine.setProduct(product);
        saleLine.setQuantity(2);
        saleLine.setUnitPrice(new BigDecimal("50.00"));
        saleLine.setUnitCost(new BigDecimal("30.00"));

        Sale sale = new Sale();
        sale.setTotal(new BigDecimal("100.00"));
        sale.setAmountPaid(new BigDecimal("40.00"));
        sale.addLine(saleLine);

        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));
        when(refundLines.sumReturnedQuantityBySaleLineId(saleLineId)).thenReturn(0L);
        when(products.findByIdForUpdate(productId)).thenReturn(Optional.of(product));
        when(refunds.save(any(SaleRefund.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SaleRefundService service = new SaleRefundService(
                sales, refunds, refundLines, products, stockMovements);

        SaleRefund result = service.refund(saleId,
                new RefundRequest(List.of(new RefundLineRequest(saleLineId, 1)), "Retour"));

        assertEquals(new BigDecimal("50.00"), result.getAmount());
        assertEquals(new BigDecimal("50.00"), result.getCreditApplied());
        assertEquals(new BigDecimal("0.00"), result.getCashRefunded());
        assertEquals(new BigDecimal("10.00"), sale.getRemaining());
    }

    @Test
    void refusesReturningMoreThanRemainingQuantity() throws Exception {
        UUID saleId = UUID.randomUUID();
        UUID saleLineId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        setId(product, productId);
        product.setName("Smartphone");

        SaleLine saleLine = new SaleLine();
        setId(saleLine, saleLineId);
        saleLine.setProduct(product);
        saleLine.setQuantity(2);
        saleLine.setUnitPrice(new BigDecimal("50.00"));

        Sale sale = new Sale();
        sale.setTotal(new BigDecimal("100.00"));
        sale.setAmountPaid(new BigDecimal("100.00"));
        sale.addLine(saleLine);

        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));
        when(refundLines.sumReturnedQuantityBySaleLineId(saleLineId)).thenReturn(1L);

        SaleRefundService service = new SaleRefundService(
                sales, refunds, refundLines, products, stockMovements);

        assertThrows(IllegalArgumentException.class, () -> service.refund(saleId,
                new RefundRequest(List.of(new RefundLineRequest(saleLineId, 2)), "Retour")));
        verifyNoInteractions(products, stockMovements);
        verify(refunds, never()).save(any(SaleRefund.class));
    }

    private static void setId(Object entity, UUID id) throws Exception {
        Field field = entity.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(entity, id);
    }
}