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
import smartshop.repository.SaleRepository;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Lot A : promotions, code PIN du propriétaire, aides aux achats, analyses, facture vérifiable. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class InsightsIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private SaleRepository saleRepository;

    private String owner;
    private String phoneId;
    private String caseId;

    @BeforeEach
    void setUp() throws Exception {
        owner = call(null, post("/api/auth/register"), """
                {"name":"Patron","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        phoneId = call(owner, post("/api/products"), """
                {"reference":"S24","name":"Galaxy S24","brand":"Samsung","salePrice":1000,"purchasePrice":700,"initialStock":5,"alertThreshold":2}""", 201)
                .get("id").asText();
        caseId = call(owner, post("/api/products"), """
                {"reference":"COQ","name":"Coque","brand":"Generic","salePrice":100,"purchasePrice":30,"initialStock":50}""", 201)
                .get("id").asText();
    }

    @Test
    void promotionsChangeCatalogPriceAndSalePrice() throws Exception {
        String today = LocalDate.now().toString();
        call(owner, post("/api/promotions"), """
                {"name":"Semaine Samsung","kind":"PERCENT_OFF","value":10,"brand":"Samsung","startsOn":"%s","endsOn":"%s"}""".formatted(today, today), 201);
        call(owner, post("/api/promotions"), """
                {"name":"Coques","kind":"SECOND_ITEM_PERCENT","value":50,"productId":"%s","startsOn":"%s","endsOn":"%s"}""".formatted(caseId, today, today), 201);

        JsonNode phone = call(owner, get("/api/products/" + phoneId), null, 200);
        assertThat(phone.get("promoPrice").decimalValue()).isEqualByComparingTo("900.00");
        assertThat(phone.get("promoLabel").asText()).contains("Semaine Samsung");

        // Prix non imposé : la promotion s'applique (3 coques, la 2e à -50 % -> 250 / 3)
        JsonNode sale = call(owner, post("/api/sales"), """
                {"lines":[{"productId":"%s","quantity":1},{"productId":"%s","quantity":3}]}""".formatted(phoneId, caseId), 201);
        assertThat(sale.get("lines").get(0).get("unitPrice").decimalValue()).isEqualByComparingTo("900.00");
        assertThat(sale.get("lines").get(1).get("unitPrice").decimalValue()).isEqualByComparingTo("83.33");

        // Promotion terminée : plus de prix promo
        String yesterday = LocalDate.now().minusDays(1).toString();
        String promoId = call(owner, get("/api/promotions"), null, 200).get(0).get("id").asText();
        call(owner, put("/api/promotions/" + promoId), """
                {"name":"Semaine Samsung","kind":"PERCENT_OFF","value":10,"brand":"Samsung","startsOn":"%s","endsOn":"%s"}""".formatted(yesterday, yesterday), 200);
        assertThat(call(owner, get("/api/products/" + phoneId), null, 200).get("promoPrice").isNull()).isTrue();
    }

    @Test
    void bigDiscountAndCancellationNeedOwnerPin() throws Exception {
        call(owner, put("/api/settings"), "{\"maxDiscountPercent\":10}", 200);
        call(owner, put("/api/settings/approval-pin"), "{\"pin\":\"2468\"}", 204);
        assertThat(call(owner, get("/api/settings"), null, 200).get("hasApprovalPin").asBoolean()).isTrue();

        call(owner, post("/api/users"), """
                {"name":"Salma","email":"caisse@shop.test","password":"Caissiere-2026","role":"CASHIER"}""", 201);
        String cashier = call(null, post("/api/auth/login"), "{\"email\":\"caisse@shop.test\",\"password\":\"Caissiere-2026\"}", 200).get("token").asText();

        String bigDiscount = "{\"discountPercent\":20,\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]%s}";
        JsonNode refused = call(cashier, post("/api/sales"), bigDiscount.formatted(phoneId, ""), 403);
        assertThat(refused.get("code").asText()).isEqualTo("APPROVAL_REQUIRED");
        call(cashier, post("/api/sales"), bigDiscount.formatted(phoneId, ",\"approvalPin\":\"0000\""), 403);
        // Négocier le prix à la baisse compte aussi comme une remise
        call(cashier, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":1,\"unitPrice\":700}]}".formatted(phoneId), 403);
        String saleId = call(cashier, post("/api/sales"), bigDiscount.formatted(phoneId, ",\"approvalPin\":\"2468\""), 201).get("id").asText();
        // Petite remise : pas besoin du code
        call(cashier, post("/api/sales"), "{\"discountPercent\":5,\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(caseId), 201);

        call(cashier, post("/api/sales/" + saleId + "/cancel"), "{\"reason\":\"Erreur\"}", 403);
        call(cashier, post("/api/sales/" + saleId + "/cancel"), "{\"reason\":\"Erreur\",\"approvalPin\":\"2468\"}", 200);
        // Le propriétaire n'a jamais besoin de son code
        call(owner, post("/api/sales"), bigDiscount.formatted(phoneId, ""), 201);
    }

    @Test
    void purchasingHelpersAndInsights() throws Exception {
        String atlas = call(owner, post("/api/suppliers"), "{\"name\":\"Atlas Distribution\"}", 201).get("id").asText();
        String nord = call(owner, post("/api/suppliers"), "{\"name\":\"Nord Import\"}", 201).get("id").asText();
        call(owner, post("/api/purchases"), "{\"supplierId\":\"%s\",\"lines\":[{\"productId\":\"%s\",\"quantity\":2,\"unitPrice\":720}]}".formatted(atlas, phoneId), 201);
        call(owner, post("/api/purchases"), "{\"supplierId\":\"%s\",\"lines\":[{\"productId\":\"%s\",\"quantity\":1,\"unitPrice\":690}]}".formatted(nord, phoneId), 201);

        JsonNode prices = call(owner, get("/api/stock/supplier-prices/" + phoneId), null, 200);
        assertThat(prices).hasSize(2);
        assertThat(prices.get(0).get("supplierName").asText()).isEqualTo("Nord Import");
        assertThat(prices.get(0).get("cheapest").asBoolean()).isTrue();

        // 6 téléphones vendus sur 30 jours avec 8 en stock -> stock bas bientôt
        call(owner, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":6}]}".formatted(phoneId), 201);
        JsonNode replenish = call(owner, get("/api/stock/replenishment?days=30&coverDays=30"), null, 200);
        JsonNode phone = null;
        for (JsonNode r : replenish) if (r.get("productId").asText().equals(phoneId)) phone = r;
        assertThat(phone).isNotNull();
        assertThat(phone.get("suggestedQuantity").asInt()).isEqualTo(6); // ceil(0.2 × 30) + 2 - 2
        assertThat(phone.get("lastSupplierName").asText()).isEqualTo("Nord Import");

        assertThat(call(owner, get("/api/stock/dormant?days=60"), null, 200).isArray()).isTrue();

        JsonNode insights = call(owner, get("/api/reports/insights"), null, 200);
        assertThat(insights.get("byWeekday")).hasSize(7);
        assertThat(insights.get("byHour")).hasSize(24);
        assertThat(insights.get("byBrand").get(0).get("brand").asText()).isEqualTo("Samsung");
        assertThat(insights.get("month").get("current").get("sales").asInt()).isEqualTo(1);
    }

    @Test
    void invoiceQrCodeLeadsToPublicVerificationPage() throws Exception {
        String saleId = call(owner, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(phoneId), 201).get("id").asText();
        byte[] pdf = mvc.perform(get("/api/sales/" + saleId + "/invoice.pdf").header("Authorization", "Bearer " + owner))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");

        String code = saleRepository.findById(UUID.fromString(saleId)).orElseThrow().getVerificationCode();
        assertThat(code).hasSize(20);
        // Page publique : pas besoin d'être connecté
        String page = mvc.perform(get("/verify/" + code)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(page).contains("Facture authentique", "FAC-");
        assertThat(mvc.perform(get("/verify/AAAAAAAAAAAAAAAAAAAA")).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("Facture introuvable");
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
