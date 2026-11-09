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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Bloc 1 : paramètres boutique, numérotation, remise en %, facture / BL / ticket, devis. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class DocumentsIntegrationTest {

    private static final String YEAR = String.valueOf(Year.now().getValue());

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token;
    private String productId;

    @BeforeEach
    void setUp() throws Exception {
        JsonNode auth = call(post("/api/auth/register"), """
                {"name":"Owner","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201);
        token = auth.get("token").asText();
        productId = call(post("/api/products"), """
                {"reference":"A54","name":"Galaxy A54","salePrice":1200.00,"purchasePrice":900.00,
                 "initialStock":10,"alertThreshold":2}""", 201).get("id").asText();
    }

    @Test
    void settingsAreSavedAndValidated() throws Exception {
        call(put("/api/settings"), """
                {"shopName":"Boutique Atlas","city":"Casablanca","ice":"001234567000089","defaultVatRate":20}""", 200);
        mvc.perform(auth(get("/api/settings")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shopName").value("Boutique Atlas"))
                .andExpect(jsonPath("$.quoteValidityDays").value(30));

        // ICE marocain : exactement 15 chiffres
        mvc.perform(auth(put("/api/settings")).contentType(MediaType.APPLICATION_JSON).content("{\"ice\":\"123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.ice").exists());
    }

    @Test
    void salesAreNumberedAndPercentDiscountIsApplied() throws Exception {
        JsonNode first = sale("""
                {"discountPercent":10,"lines":[{"productId":"%s","quantity":2}]}""".formatted(productId));
        JsonNode second = sale("""
                {"lines":[{"productId":"%s","quantity":1,"unitPrice":1150.00}]}""".formatted(productId));

        assertThat(first.get("number").asText()).isEqualTo("VT-" + YEAR + "-00001");
        assertThat(second.get("number").asText()).isEqualTo("VT-" + YEAR + "-00002");
        // 2 × 1200 = 2400, remise 10 % = 240
        assertThat(first.get("discount").decimalValue()).isEqualByComparingTo("240.00");
        assertThat(first.get("total").decimalValue()).isEqualByComparingTo("2160.00");
        // Prix négocié sur la ligne
        assertThat(second.get("total").decimalValue()).isEqualByComparingTo("1150.00");
    }

    @Test
    void invoiceNumberIsIssuedOnceAndPdfsAreGenerated() throws Exception {
        String saleId = sale("""
                {"lines":[{"productId":"%s","quantity":1}]}""".formatted(productId)).get("id").asText();

        JsonNode invoice = call(post("/api/sales/" + saleId + "/invoice"), null, 200);
        JsonNode again = call(post("/api/sales/" + saleId + "/invoice"), null, 200);
        assertThat(invoice.get("invoiceNumber").asText()).isEqualTo("FAC-" + YEAR + "-00001");
        assertThat(again.get("invoiceNumber").asText()).isEqualTo(invoice.get("invoiceNumber").asText());

        for (String path : new String[]{"invoice.pdf", "delivery-note.pdf", "ticket.pdf?width=58", "ticket.pdf?width=80"}) {
            byte[] pdf = mvc.perform(auth(get("/api/sales/" + saleId + "/" + path)))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                    .andReturn().getResponse().getContentAsByteArray();
            assertThat(new String(pdf, 0, 5)).as(path).isEqualTo("%PDF-");
        }
        mvc.perform(auth(get("/api/sales/" + saleId)))
                .andExpect(jsonPath("$.deliveryNumber").value("BL-" + YEAR + "-00001"));
    }

    @Test
    void quoteDoesNotTouchStockUntilConverted() throws Exception {
        JsonNode quote = call(post("/api/quotes"), """
                {"customerName":"Société Nour","discount":100,
                 "lines":[{"productId":"%s","quantity":3,"unitPrice":1100.00}]}""".formatted(productId), 201);
        String quoteId = quote.get("id").asText();
        assertThat(quote.get("number").asText()).isEqualTo("DEV-" + YEAR + "-00001");
        assertThat(quote.get("total").decimalValue()).isEqualByComparingTo("3200.00");
        assertThat(quote.get("status").asText()).isEqualTo("PENDING");
        assertThat(stock()).isEqualTo(10);

        byte[] pdf = mvc.perform(auth(get("/api/quotes/" + quoteId + "/pdf")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");

        call(put("/api/quotes/" + quoteId + "/status"), "{\"status\":\"ACCEPTED\"}", 200);
        JsonNode sale = call(post("/api/quotes/" + quoteId + "/convert"), "{}", 201);
        assertThat(sale.get("total").decimalValue()).isEqualByComparingTo("3200.00");
        assertThat(stock()).isEqualTo(7);

        mvc.perform(auth(get("/api/quotes/" + quoteId)))
                .andExpect(jsonPath("$.status").value("CONVERTED"))
                .andExpect(jsonPath("$.saleId").value(sale.get("id").asText()));
        // Un devis ne peut être converti qu'une fois
        mvc.perform(auth(post("/api/quotes/" + quoteId + "/convert")).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    // ---- utilitaires

    private JsonNode sale(String body) throws Exception {
        return call(post("/api/sales"), body, 201);
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
        String response = mvc.perform(r)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return response.isEmpty() ? null : json.readTree(response);
    }
}
