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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Plusieurs boutiques dans la même base : aucune ne voit ni ne modifie les données d'une autre. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class MultiShopIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String nour;
    private String tech;
    private String nourProduct;

    @BeforeEach
    void setUp() throws Exception {
        nour = call(null, post("/api/auth/register"), """
                {"name":"Karim","email":"karim@nour.test","password":"Correct-Horse-42","shopName":"Phone Nour"}""", 201).get("token").asText();
        tech = call(null, post("/api/auth/register"), """
                {"name":"Sara","email":"sara@tech.test","password":"Correct-Horse-43","shopName":"Tech Store"}""", 201).get("token").asText();
        // Même référence dans les deux boutiques : autorisé (unique par boutique)
        nourProduct = call(nour, post("/api/products"), """
                {"reference":"A15","name":"Galaxy A15","salePrice":500,"purchasePrice":350,"initialStock":5}""", 201).get("id").asText();
        call(tech, post("/api/products"), """
                {"reference":"A15","name":"Redmi 13","salePrice":900,"initialStock":2}""", 201);
    }

    @Test
    void shopsNeverSeeEachOther() throws Exception {
        assertThat(call(nour, get("/api/products"), null, 200).findValuesAsText("name")).containsExactly("Galaxy A15");
        assertThat(call(tech, get("/api/products"), null, 200).findValuesAsText("name")).containsExactly("Redmi 13");
        // Accès direct par identifiant à la donnée d'une autre boutique : introuvable
        call(tech, get("/api/products/" + nourProduct), null, 404);
        call(tech, put("/api/products/" + nourProduct), """
                {"reference":"A15","name":"Piraté","salePrice":1,"alertThreshold":1}""", 404);
        call(tech, post("/api/sales"), """
                {"lines":[{"productId":"%s","quantity":1}]}""".formatted(nourProduct), 404);

        // Numérotation indépendante : chaque boutique commence à 00001
        String nourSale = call(nour, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(nourProduct), 201).get("number").asText();
        String techProduct = call(tech, get("/api/products"), null, 200).get(0).get("id").asText();
        String techSale = call(tech, post("/api/sales"), "{\"lines\":[{\"productId\":\"%s\",\"quantity\":1}]}".formatted(techProduct), 201).get("number").asText();
        assertThat(nourSale).endsWith("-00001");
        assertThat(techSale).isEqualTo(nourSale);
        assertThat(call(tech, get("/api/sales"), null, 200)).hasSize(1);
        assertThat(call(tech, get("/api/reports/today"), null, 200).get("revenue").decimalValue()).isEqualByComparingTo("900");

        // Clients, équipe, paramètres, synchronisation : chacun les siens
        call(nour, post("/api/customers"), "{\"name\":\"Client Nour\"}", 201);
        assertThat(call(tech, get("/api/customers"), null, 200)).isEmpty();
        assertThat(call(tech, get("/api/users"), null, 200).findValuesAsText("email")).containsExactly("sara@tech.test");
        assertThat(call(tech, get("/api/settings"), null, 200).get("shopName").asText()).isEqualTo("Tech Store");
        assertThat(call(tech, get("/api/sync/pull"), null, 200).get("products").findValuesAsText("name")).containsExactly("Redmi 13");
    }

    @Test
    void onlineShopAndBackupsArePerShop() throws Exception {
        String nourSlug = call(nour, get("/api/shop"), null, 200).get("slug").asText();
        assertThat(nourSlug).isEqualTo("phone-nour");
        call(nour, put("/api/settings"), "{\"shopName\":\"Phone Nour\",\"onlineShopEnabled\":true}", 200);
        JsonNode catalog = call(null, get("/api/public/" + nourSlug + "/catalog"), null, 200);
        assertThat(catalog.get("products").findValuesAsText("name")).containsExactly("Galaxy A15");
        call(null, get("/api/public/tech-store/catalog"), null, 404); // boutique en ligne non ouverte
        call(null, get("/api/public/inconnue/catalog"), null, 404);
        JsonNode placed = call(null, post("/api/public/" + nourSlug + "/orders"), """
                {"name":"Ali","phone":"0611223344","lines":[{"productId":"%s","quantity":1}]}""".formatted(nourProduct), 201);
        assertThat(placed.get("number").asText()).startsWith("CMD-");
        assertThat(call(nour, get("/api/online-orders"), null, 200)).hasSize(1);
        assertThat(call(tech, get("/api/online-orders"), null, 200)).isEmpty();

        // Sauvegarde : seulement les données de la boutique ; la restaurer ne touche pas l'autre boutique
        String backup = call(nour, post("/api/backups"), null, 200).get("name").asText();
        call(tech, get("/api/backups/" + backup), null, 404);
        assertThat(call(tech, get("/api/backups"), null, 200)).isEmpty();
        call(nour, post("/api/products"), "{\"reference\":\"NEW\",\"name\":\"Nouveau\",\"salePrice\":10}", 201);
        call(nour, post("/api/backups/" + backup + "/restore"), null, 200);
        assertThat(call(nour, get("/api/products"), null, 200).findValuesAsText("name")).containsExactly("Galaxy A15");
        assertThat(call(tech, get("/api/products"), null, 200).findValuesAsText("name")).containsExactly("Redmi 13");
        call(null, post("/api/auth/login"), "{\"email\":\"karim@nour.test\",\"password\":\"Correct-Horse-42\"}", 200);

        // Un employé inscrit avec les identifiants de Sara rejoint Tech Store
        String employee = call(null, post("/api/auth/register-employee"), """
                {"name":"Nadia","email":"nadia@tech.test","password":"Nadia-2026!","role":"SELLER","ownerEmail":"sara@tech.test","ownerPassword":"Correct-Horse-43"}""", 201)
                .get("token").asText();
        assertThat(call(employee, get("/api/products"), null, 200).findValuesAsText("name")).containsExactly("Redmi 13");
        // Email déjà utilisé dans une autre boutique : refusé
        call(null, post("/api/auth/register"), """
                {"name":"Karim","email":"karim@nour.test","password":"Correct-Horse-42","shopName":"Doublon"}""", 400);
    }

    @Autowired
    private jakarta.persistence.EntityManagerFactory emf;

    /** Toute nouvelle table de boutique doit être préparée avant Hibernate (sinon colonne manquante sur une vraie base). */
    @Test
    void everyShopTableIsPreparedForExistingDatabases() throws Exception {
        java.lang.reflect.Field field = smartshop.tenancy.ShopColumnPreparer.class.getDeclaredField("TABLES");
        field.setAccessible(true);
        @SuppressWarnings("unchecked")
        java.util.List<String> prepared = (java.util.List<String>) field.get(null);
        for (var entity : emf.getMetamodel().getEntities()) {
            Class<?> type = entity.getJavaType();
            if (!smartshop.entity.TenantEntity.class.isAssignableFrom(type)) continue;
            String table = type.getAnnotation(jakarta.persistence.Table.class).name();
            assertThat(prepared).as(type.getSimpleName()).contains(table);
        }
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
