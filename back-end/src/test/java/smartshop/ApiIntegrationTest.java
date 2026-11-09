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

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class ApiIntegrationTest {

    private static final String EMAIL = "owner@shop.test";
    private static final String PASSWORD = "Correct-Horse-42";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token;

    @BeforeEach
    void registerOwner() throws Exception {
        String body = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Owner","email":"%s","password":"%s"}""".formatted(EMAIL, PASSWORD)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        token = json.readTree(body).get("token").asText();
    }

    @Test
    void healthEndpointIsPublic() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void protectedRouteWithoutTokenReturns401Problem() throws Exception {
        mvc.perform(get("/api/products"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void secondRegistrationIsRefused() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Other","email":"other@shop.test","password":"Another-Pass-1"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void loginSucceedsWithCorrectPassword() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(EMAIL, PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void loginIsLockedAfterRepeatedFailures() throws Exception {
        String wrong = """
                {"email":"%s","password":"wrong-password"}""".formatted(EMAIL);
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(wrong))
                    .andExpect(status().isUnauthorized());
        }
        // Même avec le bon mot de passe, le compte reste bloqué pendant la durée de verrouillage
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(EMAIL, PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void unknownProductReturns404Problem() throws Exception {
        mvc.perform(get("/api/products/" + UUID.randomUUID()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.message").value("Produit introuvable"));
    }

    @Test
    void invalidProductReturnsFieldErrors() throws Exception {
        String body = mvc.perform(post("/api/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        JsonNode errors = json.readTree(body).get("errors");
        org.assertj.core.api.Assertions.assertThat(errors).isNotNull();
        org.assertj.core.api.Assertions.assertThat(errors.size()).isPositive();
    }

    @Test
    void productCanBeCreatedAndRead() throws Exception {
        String created = mvc.perform(post("/api/products")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reference":"IP15-128","name":"iPhone 15","salePrice":9999.00,
                                 "purchasePrice":8500.00,"initialStock":3,"alertThreshold":1}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        String id = json.readTree(created).get("id").asText();

        mvc.perform(get("/api/products/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reference").value("IP15-128"));
    }
}
