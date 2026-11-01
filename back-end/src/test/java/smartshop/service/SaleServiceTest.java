package smartshop.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import smartshop.entity.*;
import smartshop.repository.*;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SaleServiceTest {
    @Mock private SaleRepository sales;
    @Mock private CustomerRepository customers;
    @Mock private CustomerPaymentRepository payments;
    @Mock private ProductRepository products;
    @Mock private StockMovementRepository movements;
    @Mock private SaleRefundLineRepository refundLines;

    @Test
    void cancellationRestoresOnlyUnitsNotAlreadyReturned() throws Exception {
        UUID saleId = UUID.randomUUID();
        UUID saleLineId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Product product = new Product();
        setId(product, productId);
        product.setStockQuantity(4);

        SaleLine line = new SaleLine();
        setId(line, saleLineId);
        line.setProduct(product);
        line.setQuantity(3);

        Sale sale = new Sale();
        setId(sale, saleId);
        sale.addLine(line);

        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));
        when(refundLines.sumReturnedQuantityBySaleLineId(saleLineId)).thenReturn(1L);
        when(products.findByIdForUpdate(productId)).thenReturn(Optional.of(product));

        SaleService service = new SaleService(
                sales, customers, payments, products, movements, refundLines);

        service.cancel(saleId, "Annulation après retour partiel");

        assertEquals(6, product.getStockQuantity());
        verify(movements).save(argThat(movement ->
                movement.getType() == StockMovementType.SALE_CANCELLATION
                        && movement.getQuantity() == 2
                        && saleId.equals(movement.getReferenceId())));
    }

    @Test
    void retryingCancellationDoesNotRestoreStockAgain() throws Exception {
        UUID saleId = UUID.randomUUID();
        Sale sale = new Sale();
        setId(sale, saleId);
        sale.setStatus(SaleStatus.CANCELLED);
        when(sales.findByIdForUpdate(saleId)).thenReturn(Optional.of(sale));

        SaleService service = new SaleService(
                sales, customers, payments, products, movements, refundLines);

        service.cancel(saleId, "Retry");

        verifyNoInteractions(products, movements, refundLines);
    }

    private static void setId(Object entity, UUID id) throws Exception {
        Field field = entity.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(entity, id);
    }
}
