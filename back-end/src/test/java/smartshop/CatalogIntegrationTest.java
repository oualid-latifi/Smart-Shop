package smartshop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Lot B : variantes de produits et étiquettes code-barres. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class CatalogIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Test
    void variantsShareAFamilyAndLabelsArePrinted() throws Exception {
        String token = call(null, post("/api/auth/register"), """
                {"name":"Patron","email":"owner@shop.test","password":"Correct-Horse-42"}""", 201).get("token").asText();
        JsonNode source = call(token, post("/api/products"), """
                {"reference":"IP15-128-N","name":"iPhone 15","brand":"Apple","color":"Noir","capacity":"128 Go",
                 "barcode":"0194253401234","salePrice":8990,"purchasePrice":7600,"initialStock":3}""", 201);
        String sourceId = source.get("id").asText();

        JsonNode variant = call(token, post("/api/products/" + sourceId + "/variants"), """
                {"reference":"IP15-256-B","color":"Bleu","capacity":"256 Go","salePrice":10490}""", 201);
        assertThat(variant.get("variantGroup").asText()).isEqualTo("iPhone 15");
        assertThat(variant.get("brand").asText()).isEqualTo("Apple");
        assertThat(variant.get("stockQuantity").asInt()).isZero();
        assertThat(call(token, get("/api/products/" + sourceId), null, 200).get("variantGroup").asText()).isEqualTo("iPhone 15");
        // La référence d'une variante reste unique
        call(token, post("/api/products/" + sourceId + "/variants"), "{\"reference\":\"IP15-256-B\"}", 400);

        for (String format : new String[]{"A4", "THERMAL"}) {
            byte[] pdf = mvc.perform(get("/api/products/labels.pdf?copies=2&format=" + format
                            + "&ids=" + sourceId + "," + variant.get("id").asText())
                            .header("Authorization", "Bearer " + token))
                    .andReturn().getResponse().getContentAsByteArray();
            assertThat(new String(pdf, 0, 5)).as(format).isEqualTo("%PDF-");
            String out = System.getProperty("labels.out");
            if (out != null) Files.write(Path.of(out, "labels-" + format + ".pdf"), pdf);
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
