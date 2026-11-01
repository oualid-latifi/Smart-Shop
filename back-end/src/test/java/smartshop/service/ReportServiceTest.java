package smartshop.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import smartshop.dto.ReportSummaryResponse;
import smartshop.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {
    @Mock private SaleRepository sales;
    @Mock private SaleLineRepository saleLines;
    @Mock private CustomerPaymentRepository customerPayments;
    @Mock private PurchaseRepository purchases;
    @Mock private PurchasePaymentRepository purchasePayments;
    @Mock private ExpenseRepository expenses;
    @Mock private ProductRepository products;
    @Mock private SaleRefundRepository refunds;
    @Mock private SaleRefundLineRepository refundLines;

    @Test
    void summaryUsesRefundsAndPaymentLedgersWithoutDoubleCounting() {
        when(sales.countValidatedBetween(any(), any())).thenReturn(2L);
        when(sales.sumTotalBetween(any(), any())).thenReturn(money("200.00"));
        when(sales.sumWalkInPaidBetween(any(), any())).thenReturn(money("40.00"));
        when(sales.sumAllDebt()).thenReturn(money("30.00"));
        when(saleLines.sumCostBetween(any(), any())).thenReturn(money("80.00"));
        when(saleLines.findTopProducts(any(), any(), any())).thenReturn(java.util.List.of());
        when(customerPayments.sumValidatedBetween(any(), any())).thenReturn(money("100.00"));
        when(purchases.sumTotalBetween(any(), any())).thenReturn(money("120.00"));
        when(purchases.sumAllDebt()).thenReturn(money("25.00"));
        when(purchasePayments.sumBetween(any(), any())).thenReturn(money("50.00"));
        when(expenses.sumBetween(any(), any())).thenReturn(money("15.00"));
        when(products.sumStockValue()).thenReturn(money("300.00"));
        when(products.countLowStock()).thenReturn(2L);
        when(refunds.sumBetween(any(), any())).thenReturn(money("20.00"));
        when(refunds.sumCashRefundedBetween(any(), any())).thenReturn(money("10.00"));
        when(refundLines.sumReturnedCostBetween(any(), any())).thenReturn(money("15.00"));

        ReportService service = new ReportService(
                sales, saleLines, customerPayments, purchases, purchasePayments,
                expenses, products, refunds, refundLines);

        ReportSummaryResponse report = service.summary(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31));

        assertEquals(2L, report.salesCount());
        assertMoney("180.00", report.revenue());
        assertMoney("65.00", report.costOfGoodsSold());
        assertMoney("115.00", report.grossProfit());
        assertMoney("15.00", report.expenses());
        assertMoney("100.00", report.netProfit());
        assertMoney("130.00", report.cashCollected());
        assertMoney("50.00", report.paidToSuppliers());
        assertMoney("120.00", report.purchasesTotal());
        assertMoney("65.00", report.netCashFlow());
        assertMoney("30.00", report.totalCustomerDebt());
        assertMoney("25.00", report.totalSupplierDebt());
        assertMoney("300.00", report.stockValue());
        assertEquals(2L, report.lowStockCount());
    }

    private static BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, money(expected).compareTo(actual));
    }
}
