package smartshop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Bloc 2 : modes de paiement, chèques, retours, relevé de compte, ancienneté des créances. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class PaymentsIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token;
    private String productId;
    private String customerId;

    @BeforeEach
    void setUp() throws Exception {
        token = call(post("/api/auth/register"), """
                {"name":"Owner","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        productId = call(post("/api/products"), """
                {"reference":"P1","name":"Écouteurs","salePrice":500.00,"purchasePrice":300.00,"initialStock":10}""", 201)
                .get("id").asText();
        customerId = call(post("/api/customers"), """
                {"name":"Karim","phone":"0661223344"}""", 201).get("id").asText();
    }

    @Test
    void checkPaymentCanBounceAndDebtComesBack() throws Exception {
        String due = LocalDate.now().plusDays(5).toString();
        call(post("/api/sales"), """
                {"customerId":"%s","amountPaid":600,"paymentMethod":"CHECK",
                 "check":{"number":"CH-778","bank":"Attijariwafa","dueDate":"%s"},
                 "lines":[{"productId":"%s","quantity":2}]}""".formatted(customerId, due, productId), 201);
        assertThat(balance()).isEqualByComparingTo("400.00");

        JsonNode checks = call(get("/api/checks?status=PENDING"), null, 200);
        assertThat(checks).hasSize(1);
        assertThat(checks.get(0).get("amount").decimalValue()).isEqualByComparingTo("600.00");
        assertThat(checks.get(0).get("daysUntilDue").asLong()).isEqualTo(5);

        String operationId = checks.get(0).get("operationId").asText();
        call(post("/api/checks/" + operationId + "/bounced"), null, 200);
        assertThat(balance()).isEqualByComparingTo("1000.00");
        assertThat(call(get("/api/checks?status=PENDING"), null, 200)).isEmpty();
        // Un chèque impayé ne peut pas être ensuite marqué encaissé
        call(post("/api/checks/" + operationId + "/cashed"), null, 400);
    }

    @Test
    void checkRequiresRegisteredCustomerAndDetails() throws Exception {
        call(post("/api/sales"), """
                {"paymentMethod":"CHECK","lines":[{"productId":"%s","quantity":1}]}""".formatted(productId), 400);
        call(post("/api/sales"), """
                {"customerId":"%s","paymentMethod":"CHECK","lines":[{"productId":"%s","quantity":1}]}""".formatted(customerId, productId), 400);
    }

    @Test
    void statementBalanceMatchesCustomerDebt() throws Exception {
        call(post("/api/sales"), """
                {"customerId":"%s","amountPaid":0,"lines":[{"productId":"%s","quantity":3}]}""".formatted(customerId, productId), 201);
        call(post("/api/customers/" + customerId + "/payments"), """
                {"amount":700,"method":"TRANSFER"}""", 200);

        JsonNode st = call(get("/api/customers/" + customerId + "/statement"), null, 200);
        assertThat(st.get("totalDebit").decimalValue()).isEqualByComparingTo("1500.00");
        assertThat(st.get("totalCredit").decimalValue()).isEqualByComparingTo("700.00");
        assertThat(st.get("closingBalance").decimalValue()).isEqualByComparingTo(balance());
        assertThat(st.get("entries").get(1).get("label").asText()).isEqualTo("Virement");

        byte[] pdf = mvc.perform(auth(get("/api/customers/" + customerId + "/statement.pdf")))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");

        JsonNode aging = call(get("/api/customers/aging"), null, 200);
        assertThat(aging).hasSize(1);
        assertThat(aging.get(0).get("days0to30").decimalValue()).isEqualByComparingTo("800.00");
    }

    @Test
    void returnOfPaidSaleRestocksAndRefunds() throws Exception {
        String saleId = call(post("/api/sales"), """
                {"lines":[{"productId":"%s","quantity":2}]}""".formatted(productId), 201).get("id").asText();
        assertThat(stock()).isEqualTo(8);

        JsonNode sale = call(post("/api/sales/" + saleId + "/returns"), """
                {"reason":"Ne fonctionne pas","lines":[{"productId":"%s","quantity":1}]}""".formatted(productId), 201);
        assertThat(sale.get("returnedAmount").decimalValue()).isEqualByComparingTo("500.00");
        assertThat(sale.get("refundedAmount").decimalValue()).isEqualByComparingTo("500.00");
        assertThat(sale.get("remaining").decimalValue()).isEqualByComparingTo("0.00");
        assertThat(sale.get("lines").get(0).get("returnedQuantity").asInt()).isEqualTo(1);
        assertThat(stock()).isEqualTo(9);

        // Rapport du jour : CA net 500, coût net 300, encaissé net 500
        JsonNode report = call(get("/api/reports/today"), null, 200);
        assertThat(report.get("revenue").decimalValue()).isEqualByComparingTo("500.00");
        assertThat(report.get("costOfGoodsSold").decimalValue()).isEqualByComparingTo("300.00");
        assertThat(report.get("cashCollected").decimalValue()).isEqualByComparingTo("500.00");

        // Impossible de reprendre plus que vendu, ni d'annuler une vente avec retours
        call(post("/api/sales/" + saleId + "/returns"), """
                {"lines":[{"productId":"%s","quantity":2}]}""".formatted(productId), 400);
        call(post("/api/sales/" + saleId + "/cancel"), "{\"reason\":\"test\"}", 400);
    }

    @Test
    void returnOnCreditSaleReducesDebtFirst() throws Exception {
        String saleId = call(post("/api/sales"), """
                {"customerId":"%s","amountPaid":200,"lines":[{"productId":"%s","quantity":2}]}""".formatted(customerId, productId), 201)
                .get("id").asText();
        JsonNode sale = call(post("/api/sales/" + saleId + "/returns"), """
                {"lines":[{"productId":"%s","quantity":1,"restock":false}]}""".formatted(productId), 201);
        assertThat(sale.get("refundedAmount").decimalValue()).isEqualByComparingTo("0.00");
        assertThat(balance()).isEqualByComparingTo("300.00");
        // Article abîmé : pas remis en stock
        assertThat(stock()).isEqualTo(8);
    }

    // ---- utilitaires

    private java.math.BigDecimal balance() throws Exception {
        return call(get("/api/customers/" + customerId), null, 200).get("balance").decimalValue();
    }

    private int stock() throws Exception {
        return call(get("/api/products/" + productId), null, 200).get("stockQuantity").asInt();
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return token == null ? request : request.header("Authorization", "Bearer " + token);
    }

    private JsonNode call(MockHttpServletRequestBuilder request, String body, int expectedStatus) throws Exception {
        MockHttpServletRequestBuilder r = auth(request);
        if (body != null) r = r.contentType(MediaType.APPLICATION_JSON).content(body);
        var result = mvc.perform(r).andReturn().getResponse();
        assertThat(result.getStatus()).as(result.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).isEqualTo(expectedStatus);
        String response = result.getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return response.isEmpty() ? null : json.readTree(response);
    }
}
