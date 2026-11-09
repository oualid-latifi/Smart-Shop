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

import java.time.YearMonth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Bloc 4 : comptes et rôles, journal, caisse, objectifs, code-barres, import CSV. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class TeamIntegrationTest {

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
                {"reference":"CH-20","name":"Chargeur","barcode":"6111234567890","salePrice":100.00,"purchasePrice":60.00,"initialStock":50}""", 201)
                .get("id").asText();
    }

    private String createSeller(String email) throws Exception {
        call(owner, post("/api/users"), """
                {"name":"Yassine","email":"%s","password":"Vendeur-2026","role":"SELLER"}""".formatted(email), 201);
        return call(null, post("/api/auth/login"), """
                {"email":"%s","password":"Vendeur-2026"}""".formatted(email), 200).get("token").asText();
    }

    @Test
    void sellerCanSellButCannotSeeMarginsOrReports() throws Exception {
        String seller = createSeller("vendeur@shop.test");

        JsonNode sale = call(seller, post("/api/sales"), """
                {"lines":[{"productId":"%s","quantity":2}]}""".formatted(productId), 201);
        assertThat(sale.get("sellerName").asText()).isEqualTo("Yassine");
        assertThat(sale.get("profit").isNull()).isTrue();
        assertThat(call(seller, get("/api/products/" + productId), null, 200).get("averagePurchasePrice").isNull()).isTrue();

        call(seller, get("/api/reports/today"), null, 403);
        call(seller, post("/api/products"), "{\"reference\":\"X\",\"name\":\"X\",\"salePrice\":1}", 403);
        call(seller, get("/api/users"), null, 403);
        call(seller, post("/api/sales/" + sale.get("id").asText() + "/cancel"), "{\"reason\":\"test\"}", 403);

        // Le propriétaire voit tout
        assertThat(call(owner, get("/api/sales/" + sale.get("id").asText()), null, 200).get("profit").decimalValue())
                .isEqualByComparingTo("80.00");
    }

    @Test
    void deactivatedAccountIsLockedOutImmediately() throws Exception {
        String seller = createSeller("v2@shop.test");
        String sellerId = call(owner, get("/api/users"), null, 200).get(1).get("id").asText();
        call(owner, put("/api/users/" + sellerId), "{\"name\":\"Yassine\",\"role\":\"SELLER\",\"active\":false}", 200);

        call(seller, get("/api/products"), null, 401);
        call(null, post("/api/auth/login"), "{\"email\":\"v2@shop.test\",\"password\":\"Vendeur-2026\"}", 401);

        // Le dernier propriétaire ne peut pas se retirer ses droits
        String ownerId = call(owner, get("/api/users"), null, 200).get(0).get("id").asText();
        call(owner, put("/api/users/" + ownerId), "{\"name\":\"Patron\",\"role\":\"SELLER\",\"active\":true}", 400);
    }

    @Test
    void activityLogCashAndTargetsTrackEachSeller() throws Exception {
        String seller = createSeller("v3@shop.test");
        String sellerId = call(owner, get("/api/users"), null, 200).get(1).get("id").asText();

        call(seller, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":3}]}".formatted(productId), 201);

        JsonNode activity = call(owner, get("/api/activity?userId=" + sellerId), null, 200);
        assertThat(activity).isNotEmpty();
        assertThat(activity.get(0).get("action").asText()).isEqualTo("Vente enregistrée");
        assertThat(activity.get(0).get("userName").asText()).isEqualTo("Yassine");

        JsonNode balances = call(owner, get("/api/cash/balances"), null, 200);
        JsonNode sellerCash = null;
        for (JsonNode b : balances) if (b.get("userId").asText().equals(sellerId)) sellerCash = b;
        assertThat(sellerCash).isNotNull();
        assertThat(sellerCash.get("balance").decimalValue()).isEqualByComparingTo("300.00");

        call(owner, post("/api/cash/handins"), "{\"employeeId\":\"%s\",\"amount\":250}".formatted(sellerId), 201);
        for (JsonNode b : call(owner, get("/api/cash/balances"), null, 200)) {
            if (b.get("userId").asText().equals(sellerId)) assertThat(b.get("balance").decimalValue()).isEqualByComparingTo("50.00");
        }

        String month = YearMonth.now().toString();
        JsonNode target = call(owner, put("/api/targets"), """
                {"userId":"%s","month":"%s","amount":1000}""".formatted(sellerId, month), 200);
        assertThat(target.get("achieved").decimalValue()).isEqualByComparingTo("300.00");
        assertThat(target.get("percent").asInt()).isEqualTo(30);
        call(seller, put("/api/targets"), """
                {"userId":"%s","month":"%s","amount":1}""".formatted(sellerId, month), 403);
    }

    @Test
    void barcodeLookupAndCsvImport() throws Exception {
        assertThat(call(owner, get("/api/products/barcode/6111234567890"), null, 200).get("id").asText()).isEqualTo(productId);
        call(owner, get("/api/products/barcode/000"), null, 404);

        String csv = """
                Référence;Nom;Prix vente;Prix achat;Stock;Code barres
                CH-20;Chargeur rapide;120;;;
                CAB-1;"Câble USB-C; 1 m";35,50;15;40;6110000000001
                BAD;Sans prix;;;;
                """;
        JsonNode result = call(owner, post("/api/import/products"), json.writeValueAsString(java.util.Map.of("csv", csv)), 200);
        assertThat(result.get("created").asInt()).isEqualTo(1);
        assertThat(result.get("updated").asInt()).isEqualTo(1);
        assertThat(result.get("errors")).hasSize(1);
        assertThat(result.get("errors").get(0).get("line").asInt()).isEqualTo(4);

        JsonNode cable = call(owner, get("/api/products/barcode/6110000000001"), null, 200);
        assertThat(cable.get("name").asText()).isEqualTo("Câble USB-C; 1 m");
        assertThat(cable.get("salePrice").decimalValue()).isEqualByComparingTo("35.50");
        assertThat(cable.get("stockQuantity").asInt()).isEqualTo(40);
        // Mise à jour : le nom et le prix changent, pas le stock
        JsonNode charger = call(owner, get("/api/products/" + productId), null, 200);
        assertThat(charger.get("salePrice").decimalValue()).isEqualByComparingTo("120.00");
        assertThat(charger.get("stockQuantity").asInt()).isEqualTo(50);

        byte[] template = mvc.perform(get("/api/import/templates/products.csv").header("Authorization", "Bearer " + owner))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(template, java.nio.charset.StandardCharsets.UTF_8)).contains("reference;nom;prix_vente");
    }

    // ---- utilitaires

    private JsonNode call(String token, MockHttpServletRequestBuilder request, String body, int expectedStatus) throws Exception {
        MockHttpServletRequestBuilder r = token != null ? request.header("Authorization", "Bearer " + token) : request;
        if (body != null) r = r.contentType(MediaType.APPLICATION_JSON).content(body);
        var result = mvc.perform(r).andReturn().getResponse();
        assertThat(result.getStatus()).as(result.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).isEqualTo(expectedStatus);
        String response = result.getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return response.isEmpty() ? null : json.readTree(response);
    }
}
