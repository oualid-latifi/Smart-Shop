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

import java.time.Year;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Bloc 3 : cartons, inventaire, bons de commande, retours fournisseur, dépôts. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class StockIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token;
    private String waterId;      // vendu à l'unité ou au carton de 12
    private String supplierId;

    @BeforeEach
    void setUp() throws Exception {
        token = call(post("/api/auth/register"), """
                {"name":"Owner","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        waterId = call(post("/api/products"), """
                {"reference":"EAU-50","name":"Eau 50cl","salePrice":3.00,"unitsPerPack":12,"packPrice":30.00,
                 "purchasePrice":1.50,"initialStock":120}""", 201).get("id").asText();
        supplierId = call(post("/api/suppliers"), "{\"name\":\"Distrib Atlas\"}", 201).get("id").asText();
    }

    @Test
    void sellingByPackConvertsToUnitsAndUsesPackPrice() throws Exception {
        JsonNode sale = call(post("/api/sales"), """
                {"lines":[{"productId":"%s","quantity":2,"packs":true},{"productId":"%s","quantity":5}]}"""
                .formatted(waterId, waterId), 201);
        // 2 cartons × 30 + 5 unités × 3 = 75
        assertThat(sale.get("total").decimalValue()).isEqualByComparingTo("75.00");
        assertThat(sale.get("lines").get(0).get("quantity").asInt()).isEqualTo(24);
        assertThat(sale.get("lines").get(0).get("packCount").asInt()).isEqualTo(2);
        assertThat(stock(waterId)).isEqualTo(120 - 24 - 5);

        JsonNode daily = call(get("/api/reports/daily?days=7"), null, 200);
        assertThat(daily).hasSize(7);
        assertThat(daily.get(6).get("revenue").decimalValue()).isEqualByComparingTo("75.00");
        assertThat(call(get("/api/sales?limit=1"), null, 200)).hasSize(1);

        byte[] pdf = mvc.perform(auth(get("/api/sales/" + sale.get("id").asText() + "/ticket.pdf")))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void inventoryAppliesDifferencesOnClose() throws Exception {
        JsonNode inv = call(post("/api/inventories"), "{}", 201);
        String id = inv.get("id").asText();
        assertThat(inv.get("number").asText()).isEqualTo("INV-" + Year.now().getValue() + "-00001");
        // Un seul inventaire ouvert à la fois
        call(post("/api/inventories"), "{}", 400);

        // Une vente pendant le comptage ne doit pas être perdue
        call(post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":10}]}".formatted(waterId), 201);

        JsonNode counted = call(put("/api/inventories/" + id + "/counts"),
                "{\"counts\":[{\"productId\":\"%s\",\"countedQuantity\":115}]}".formatted(waterId), 200);
        assertThat(counted.get("discrepancyCount").asInt()).isEqualTo(1);
        assertThat(counted.get("shortageValue").decimalValue()).isEqualByComparingTo("7.50"); // 5 × 1,50

        call(post("/api/inventories/" + id + "/close"), null, 200);
        // 120 - 10 (vente) - 5 (écart compté) = 105
        assertThat(stock(waterId)).isEqualTo(105);
        call(put("/api/inventories/" + id + "/counts"),
                "{\"counts\":[{\"productId\":\"%s\",\"countedQuantity\":1}]}".formatted(waterId), 400);
    }

    @Test
    void purchaseOrderIsReceivedInTwoSteps() throws Exception {
        JsonNode order = call(post("/api/purchase-orders"), """
                {"supplierId":"%s","lines":[{"productId":"%s","quantity":5,"unitPrice":18.00,"packs":true}]}"""
                .formatted(supplierId, waterId), 201);
        String id = order.get("id").asText();
        assertThat(order.get("lines").get(0).get("quantity").asInt()).isEqualTo(60);
        assertThat(order.get("total").decimalValue()).isEqualByComparingTo("90.00");

        byte[] pdf = mvc.perform(auth(get("/api/purchase-orders/" + id + "/pdf"))).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");

        call(post("/api/purchase-orders/" + id + "/receive"),
                "{\"lines\":[{\"productId\":\"%s\",\"quantity\":24}]}".formatted(waterId), 201);
        assertThat(stock(waterId)).isEqualTo(144);
        assertThat(call(get("/api/purchase-orders/" + id), null, 200).get("status").asText()).isEqualTo("PARTIALLY_RECEIVED");

        JsonNode purchase = call(post("/api/purchase-orders/" + id + "/receive"), "{}", 201);
        assertThat(purchase.get("total").decimalValue()).isEqualByComparingTo("54.00"); // 36 × 1,50
        assertThat(stock(waterId)).isEqualTo(180);
        assertThat(call(get("/api/purchase-orders/" + id), null, 200).get("status").asText()).isEqualTo("RECEIVED");
        call(post("/api/purchase-orders/" + id + "/receive"), "{}", 400);
    }

    @Test
    void supplierReturnReducesStockAndDebt() throws Exception {
        String purchaseId = call(post("/api/purchases"), """
                {"supplierId":"%s","amountPaid":0,"lines":[{"productId":"%s","quantity":20,"unitPrice":2.00}]}"""
                .formatted(supplierId, waterId), 201).get("id").asText();
        JsonNode purchase = call(post("/api/purchases/" + purchaseId + "/returns"),
                "{\"reason\":\"Bouteilles abîmées\",\"lines\":[{\"productId\":\"%s\",\"quantity\":5}]}".formatted(waterId), 201);
        assertThat(purchase.get("returnedAmount").decimalValue()).isEqualByComparingTo("10.00");
        assertThat(purchase.get("remaining").decimalValue()).isEqualByComparingTo("30.00");
        assertThat(stock(waterId)).isEqualTo(135);
        call(post("/api/purchases/" + purchaseId + "/returns"),
                "{\"lines\":[{\"productId\":\"%s\",\"quantity\":16}]}".formatted(waterId), 400);
    }

    @Test
    void transfersMoveStockBetweenShopAndWarehouses() throws Exception {
        String depot = call(post("/api/warehouses"), "{\"name\":\"Dépôt Ain Sebaa\"}", 201).get("id").asText();
        String quarantine = call(post("/api/warehouses"), "{\"name\":\"Quarantaine\",\"type\":\"QUARANTINE\"}", 201).get("id").asText();

        call(post("/api/warehouses/transfers"), """
                {"productId":"%s","toWarehouseId":"%s","quantity":100}""".formatted(waterId, depot), 200);
        JsonNode loc = call(post("/api/warehouses/transfers"), """
                {"productId":"%s","fromWarehouseId":"%s","toWarehouseId":"%s","quantity":4,"note":"périmées"}"""
                .formatted(waterId, depot, quarantine), 200);
        assertThat(loc.get("shopQuantity").asInt()).isEqualTo(20);
        assertThat(loc.get("warehouses")).hasSize(2);
        assertThat(stock(waterId)).isEqualTo(20);

        // Valeur du stock : boutique 20 + dépôt 96 (quarantaine exclue) à 1,50
        JsonNode report = call(get("/api/reports/today"), null, 200);
        assertThat(report.get("stockValue").decimalValue()).isEqualByComparingTo("174.00");

        call(post("/api/warehouses/transfers"), """
                {"productId":"%s","fromWarehouseId":"%s","quantity":500}""".formatted(waterId, depot), 400);
        call(put("/api/warehouses/" + depot), "{\"name\":\"Dépôt\",\"active\":false}", 400);
    }

    // ---- utilitaires

    private int stock(String productId) throws Exception {
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
