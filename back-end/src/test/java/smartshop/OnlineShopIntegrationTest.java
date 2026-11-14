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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Lot D : boutique en ligne publique et commandes. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class OnlineShopIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String owner;
    private String productId;

    @BeforeEach
    void setUp() throws Exception {
        owner = call(null, post("/api/auth/register"), """
                {"name":"Patron","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        productId = call(owner, post("/api/products"), """
                {"reference":"A15","name":"Galaxy A15","brand":"Samsung","salePrice":500,"purchasePrice":350,"initialStock":3}""", 201)
                .get("id").asText();
    }

    @Test
    void closedUntilTheOwnerOpensIt() throws Exception {
        call(null, get("/api/public/catalog"), null, 404);
        call(null, post("/api/public/orders"), order(1), 404);
        String page = mvc.perform(get("/shop")).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(page).contains("<!doctype html>");
    }

    @Test
    void customerOrdersThenShopConvertsToSale() throws Exception {
        call(owner, put("/api/settings"), "{\"shopName\":\"Phone Nour\",\"phone\":\"0612345678\",\"onlineShopEnabled\":true}", 200);
        call(owner, post("/api/promotions"), """
                {"name":"Soldes","kind":"PERCENT_OFF","value":10,"startsOn":"%s","endsOn":"%s"}""".formatted(LocalDate.now(), LocalDate.now().plusDays(3)), 201);

        // Catalogue public : prix promo, jamais le prix d'achat ni le stock exact
        String raw = mvc.perform(get("/api/public/catalog")).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(raw).doesNotContain("350").doesNotContain("purchase").doesNotContain("stockQuantity");
        JsonNode p = json.readTree(raw).get("products").get(0);
        assertThat(p.get("price").decimalValue()).isEqualByComparingTo("450");
        assertThat(p.get("oldPrice").decimalValue()).isEqualByComparingTo("500");
        assertThat(p.get("inStock").asBoolean()).isTrue();

        call(null, post("/api/public/orders"), order(5), 400); // plus que le stock
        call(null, post("/api/public/orders"), """
                {"name":"Karim","phone":"abc","lines":[{"productId":"%s","quantity":1}]}""".formatted(productId), 400);
        JsonNode placed = call(null, post("/api/public/orders"), order(2), 201);
        assertThat(placed.get("number").asText()).startsWith("CMD-");
        assertThat(placed.get("total").decimalValue()).isEqualByComparingTo("900");

        // Le vendeur est prévenu et voit la commande
        assertThat(call(owner, get("/api/notifications"), null, 200).get("items").findValuesAsText("type")).contains("ONLINE_ORDER");
        JsonNode orders = call(owner, get("/api/online-orders?status=NEW"), null, 200);
        assertThat(orders).hasSize(1);
        String orderId = orders.get(0).get("id").asText();
        assertThat(call(owner, get("/api/online-orders/pending-count"), null, 200).get("count").asInt()).isEqualTo(1);

        call(owner, put("/api/online-orders/" + orderId + "/status"), "{\"status\":\"CONFIRMED\"}", 200);
        JsonNode sale = call(owner, post("/api/online-orders/" + orderId + "/convert"), "{\"amountPaid\":900}", 201);
        assertThat(sale.get("total").decimalValue()).isEqualByComparingTo("900");
        assertThat(sale.get("customerName").asText()).isEqualTo("Karim");
        call(owner, post("/api/online-orders/" + orderId + "/convert"), null, 400);
        assertThat(call(owner, get("/api/products/" + productId), null, 200).get("stockQuantity").asInt()).isEqualTo(1);
        // Le client créé est retrouvé par son téléphone à la commande suivante
        assertThat(call(owner, get("/api/customers"), null, 200).findValuesAsText("phone")).containsExactly("0611223344");
    }

    @Test
    void ordersAreRateLimited() throws Exception {
        call(owner, put("/api/settings"), "{\"onlineShopEnabled\":true}", 200);
        for (int i = 0; i < 5; i++) call(null, post("/api/public/orders"), order(1), -1);
        call(null, post("/api/public/orders"), order(1), 429);
    }

    private String order(int quantity) {
        return """
                {"name":"Karim","phone":"0611223344","address":"Casablanca","lines":[{"productId":"%s","quantity":%d}]}"""
                .formatted(productId, quantity);
    }

    private JsonNode call(String token, MockHttpServletRequestBuilder request, String body, int expectedStatus) throws Exception {
        MockHttpServletRequestBuilder r = token != null ? request.header("Authorization", "Bearer " + token) : request;
        if (body != null) r = r.contentType(MediaType.APPLICATION_JSON).content(body);
        var result = mvc.perform(r).andReturn().getResponse();
        String response = result.getContentAsString(StandardCharsets.UTF_8);
        if (expectedStatus > 0) assertThat(result.getStatus()).as(response).isEqualTo(expectedStatus);
        return response.isEmpty() ? null : json.readTree(response);
    }
}
