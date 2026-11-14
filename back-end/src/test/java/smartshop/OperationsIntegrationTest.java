package smartshop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import smartshop.service.NotificationService;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Lot C : sauvegarde / restauration, notifications, rapport hebdomadaire. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class OperationsIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private NotificationService notificationService;

    private String owner;
    private String productId;

    @BeforeEach
    void setUp() throws Exception {
        owner = call(null, post("/api/auth/register"), """
                {"name":"Patron","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        productId = call(owner, post("/api/products"), """
                {"reference":"A15","name":"Galaxy A15","salePrice":500,"purchasePrice":350,"initialStock":3,"alertThreshold":2}""", 201)
                .get("id").asText();
    }

    @Test
    void backupThenRestoreBringsDataBack() throws Exception {
        String customerId = call(owner, post("/api/customers"), "{\"name\":\"Karim\"}", 201).get("id").asText();
        call(owner, post("/api/sales"), """
                {"customerId":"%s","amountPaid":100,"lines":[{"productId":"%s","quantity":1}]}""".formatted(customerId, productId), 201);
        String backup = call(owner, post("/api/backups"), null, 200).get("name").asText();
        assertThat(call(owner, get("/api/backups"), null, 200).get(0).get("name").asText()).isEqualTo(backup);

        // Après la sauvegarde : un produit en plus, une vente en plus, un produit désactivé
        call(owner, post("/api/products"), "{\"reference\":\"NEW\",\"name\":\"Nouveau\",\"salePrice\":10}", 201);
        call(owner, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(productId), 201);
        call(owner, delete("/api/products/" + productId), null, 204);

        // Le code du propriétaire protège la restauration
        call(owner, put("/api/settings/approval-pin"), "{\"pin\":\"1357\"}", 204);
        call(owner, post("/api/backups/" + backup + "/restore"), null, 403);
        call(owner, post("/api/backups/" + backup + "/restore?pin=1357"), null, 200);

        JsonNode products = call(owner, get("/api/products"), null, 200);
        assertThat(products).hasSize(1);
        assertThat(products.get(0).get("stockQuantity").asInt()).isEqualTo(2);
        assertThat(call(owner, get("/api/sales"), null, 200)).hasSize(1);
        assertThat(call(owner, get("/api/customers/" + customerId), null, 200).get("balance").decimalValue()).isEqualByComparingTo("400.00");
        // Le compte et le mot de passe d'avant restent valables
        call(null, post("/api/auth/login"), "{\"email\":\"owner@shop.test\",\"password\":\"Correct-Horse-42\"}", 200);

        // Restauration d'un fichier envoyé depuis le téléphone
        byte[] file = mvc.perform(get("/api/backups/" + backup).header("Authorization", "Bearer " + owner))
                .andReturn().getResponse().getContentAsByteArray();
        var upload = multipart("/api/backups/upload").file(new MockMultipartFile("file", backup, "application/zip", file)).param("pin", "1357");
        call(owner, upload, null, 200);
        call(owner, multipart("/api/backups/upload").file(new MockMultipartFile("file", "x.zip", "application/zip", "pas un zip".getBytes())).param("pin", "1357"), null, 400);
    }

    @Test
    void onlyTheOwnerHandlesBackups() throws Exception {
        call(owner, post("/api/users"), """
                {"name":"Comptable","email":"compta@shop.test","password":"Comptable-2026","role":"ACCOUNTANT"}""", 201);
        String accountant = call(null, post("/api/auth/login"), "{\"email\":\"compta@shop.test\",\"password\":\"Comptable-2026\"}", 200).get("token").asText();
        call(accountant, get("/api/backups"), null, 403);
        // Tentative de sortir du dossier des sauvegardes : refusée
        call(owner, get("/api/backups/..%2F..%2Fetc%2Fpasswd"), null, 400);
    }

    @Test
    void saleTriggersNotificationsForTheRightPeople() throws Exception {
        call(owner, put("/api/settings"), "{\"bigSaleAmount\":800}", 200);
        String customerId = call(owner, post("/api/customers"), "{\"name\":\"Nour\"}", 201).get("id").asText();
        call(owner, post("/api/sales"), """
                {"customerId":"%s","amountPaid":1000,"paymentMethod":"CHECK",
                 "check":{"number":"77","dueDate":"%s"},
                 "lines":[{"productId":"%s","quantity":2}]}""".formatted(customerId, LocalDate.now().plusDays(1), productId), 201);
        notificationService.checksDueSoon();
        notificationService.checksDueSoon(); // pas de doublon le même jour

        JsonNode feed = call(owner, get("/api/notifications"), null, 200);
        assertThat(feed.get("unread").asInt()).isEqualTo(3);
        assertThat(feed.get("items").findValuesAsText("type")).containsExactlyInAnyOrder("LOW_STOCK", "BIG_SALE", "CHECK_DUE");

        // Un vendeur ne voit ni le stock bas, ni les grosses ventes, ni les chèques
        call(owner, post("/api/users"), """
                {"name":"Vendeur","email":"v@shop.test","password":"Vendeur-2026","role":"SELLER"}""", 201);
        String seller = call(null, post("/api/auth/login"), "{\"email\":\"v@shop.test\",\"password\":\"Vendeur-2026\"}", 200).get("token").asText();
        assertThat(call(seller, get("/api/notifications"), null, 200).get("items")).isEmpty();

        call(owner, post("/api/notifications/read-all"), null, 200);
        assertThat(call(owner, get("/api/notifications"), null, 200).get("unread").asInt()).isZero();
        call(owner, put("/api/notifications/push-token"), "{\"token\":\"ExponentPushToken[test]\"}", 200);
    }

    @Test
    void weeklyReportTextAndMissingMailServer() throws Exception {
        JsonNode weekly = call(owner, get("/api/reports/weekly"), null, 200);
        assertThat(weekly.get("text").asText()).contains("Chiffre d'affaires", "Bénéfice net");
        JsonNode error = call(owner, post("/api/reports/weekly/send"), null, 400);
        assertThat(error.get("message").asText()).contains("serveur email");
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
