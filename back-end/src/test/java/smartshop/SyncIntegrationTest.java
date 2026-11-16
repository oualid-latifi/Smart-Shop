package smartshop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Synchronisation téléphone (SQLite) ↔ serveur : sans perte ni doublon. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class SyncIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private JdbcTemplate jdbc;

    private String owner;
    private String phoneId;
    private String caseId;

    @BeforeEach
    void setUp() throws Exception {
        owner = call(null, post("/api/auth/register"), """
                {"name":"Patron","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        phoneId = call(owner, post("/api/products"), """
                {"reference":"A15","name":"Galaxy A15","salePrice":500,"purchasePrice":350,"initialStock":3}""", 201).get("id").asText();
        caseId = call(owner, post("/api/products"), """
                {"reference":"CASE","name":"Coque","salePrice":50,"initialStock":10}""", 201).get("id").asText();
    }

    @Test
    void offlineOperationsAreAppliedOnceInOrder() throws Exception {
        JsonNode first = call(owner, get("/api/sync/pull"), null, 200);
        assertThat(first.get("full").asBoolean()).isTrue();
        assertThat(first.get("products")).hasSize(2);

        // Hors-ligne : nouveau client, vente à crédit pour lui (il y a 2 h), puis un paiement
        LocalDateTime soldAt = LocalDateTime.now().minusHours(2).truncatedTo(ChronoUnit.SECONDS);
        String push = """
                {"operations":[
                  {"opId":"op-customer-1","type":"CUSTOMER_CREATE","payload":{"name":"Karim","phone":"0611223344"}},
                  {"opId":"op-sale-1","type":"SALE_CREATE","customerOpId":"op-customer-1","occurredAt":"%s",
                   "payload":{"amountPaid":200,"lines":[{"productId":"%s","quantity":1}]}},
                  {"opId":"op-pay-1","type":"PAYMENT_CREATE","customerOpId":"op-customer-1","payload":{"amount":100}},
                  {"opId":"op-sale-bad","type":"SALE_CREATE","payload":{"lines":[{"productId":"00000000-0000-0000-0000-000000000000","quantity":1}]}}
                ]}""".formatted(soldAt, phoneId);
        JsonNode results = call(owner, post("/api/sync/push"), push, 200).get("results");
        assertThat(results.findValuesAsText("status")).containsExactly("OK", "OK", "OK", "ERROR");
        assertThat(results.get(1).get("number").asText()).startsWith("VT-");
        assertThat(results.get(3).get("message").asText()).isNotBlank();

        // Le téléphone n'a pas reçu la réponse et renvoie tout : rien n'est appliqué deux fois
        JsonNode again = call(owner, post("/api/sync/push"), push, 200).get("results");
        assertThat(again.findValuesAsText("status")).containsExactly("DUPLICATE", "DUPLICATE", "DUPLICATE", "ERROR");
        assertThat(again.get(1).get("resultId").asText()).isEqualTo(results.get(1).get("resultId").asText());
        assertThat(again.get(1).get("number").asText()).isEqualTo(results.get(1).get("number").asText());

        JsonNode sales = call(owner, get("/api/sales"), null, 200);
        assertThat(sales).hasSize(1);
        assertThat(LocalDateTime.parse(sales.get(0).get("saleDate").asText()).truncatedTo(ChronoUnit.SECONDS)).isEqualTo(soldAt);
        assertThat(call(owner, get("/api/products/" + phoneId), null, 200).get("stockQuantity").asInt()).isEqualTo(2);
        JsonNode customers = call(owner, get("/api/customers"), null, 200);
        assertThat(customers).hasSize(1);
        assertThat(customers.get(0).get("balance").decimalValue()).isEqualByComparingTo("200"); // 500 - 200 - 100

        // Pull suivant : seulement ce qui a changé (la coque n'a pas bougé)
        jdbc.update("update products set updated_at = ? where id = ?", LocalDateTime.now().minusDays(1), java.util.UUID.fromString(caseId));
        JsonNode next = call(owner, get("/api/sync/pull").param("since", first.get("cursor").asText()).param("promoKey", first.get("promoKey").asText()), null, 200);
        assertThat(next.get("full").asBoolean()).isFalse();
        assertThat(next.get("products").findValuesAsText("id")).containsExactly(phoneId);
        assertThat(next.get("customers").findValuesAsText("name")).containsExactly("Karim");
        assertThat(next.get("sales")).hasSize(1);

        // Une promotion change les prix : tout le catalogue est renvoyé
        call(owner, post("/api/promotions"), """
                {"name":"Soldes","kind":"PERCENT_OFF","value":10,"startsOn":"%s","endsOn":"%s"}""".formatted(LocalDate.now(), LocalDate.now().plusDays(2)), 201);
        JsonNode afterPromo = call(owner, get("/api/sync/pull").param("since", next.get("cursor").asText()).param("promoKey", next.get("promoKey").asText()), null, 200);
        assertThat(afterPromo.get("full").asBoolean()).isTrue();
        assertThat(afterPromo.get("products")).hasSize(2);
    }

    @Test
    void operationsRespectTheAccountRights() throws Exception {
        call(owner, post("/api/users"), """
                {"name":"Magasinier","email":"stock@shop.test","password":"Magasin-2026","role":"STOCKKEEPER"}""", 201);
        String stock = call(null, post("/api/auth/login"), "{\"email\":\"stock@shop.test\",\"password\":\"Magasin-2026\"}", 200).get("token").asText();
        JsonNode results = call(stock, post("/api/sync/push"), """
                {"operations":[{"opId":"op-sale-x","type":"SALE_CREATE","payload":{"lines":[{"productId":"%s","quantity":1}]}}]}""".formatted(phoneId), 200).get("results");
        assertThat(results.get(0).get("status").asText()).isEqualTo("ERROR");
        assertThat(call(owner, get("/api/sales"), null, 200)).isEmpty();
        // Un magasinier ne reçoit ni les clients ni les prix d'achat
        JsonNode pull = call(stock, get("/api/sync/pull"), null, 200);
        assertThat(pull.get("customers")).isEmpty();
        assertThat(pull.get("products").get(0).get("averagePurchasePrice").isNull()).isTrue();
        call(null, get("/api/sync/pull"), null, 401);
    }

    private JsonNode call(String token, MockHttpServletRequestBuilder request, String body, int expectedStatus) throws Exception {
        MockHttpServletRequestBuilder r = token != null ? request.header("Authorization", "Bearer " + token) : request;
        if (body != null) r = r.contentType(MediaType.APPLICATION_JSON).content(body);
        var result = mvc.perform(r).andReturn().getResponse();
        String response = result.getContentAsString(StandardCharsets.UTF_8);
        assertThat(result.getStatus()).as(response).isEqualTo(expectedStatus);
        return response.isEmpty() ? null : json.readTree(response);
    }
}
