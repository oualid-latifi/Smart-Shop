package smartshop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Rapport Excel : onglets détaillés remplis avec les vraies ventes, formules valides. */
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_EACH_TEST_METHOD)
class ReportExportIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    private String token;

    @Test
    void excelReportContainsRealCustomerAndProductData() throws Exception {
        token = json.readTree(call(post("/api/auth/register"), """
                {"name":"Owner","email":"owner@shop.test","password":"Correct-Horse-42"}""")).get("token").asText();
        String phone = id(call(post("/api/products"), """
                {"reference":"IP15","name":"iPhone 15","capacity":"128 Go","brand":"Apple","salePrice":9000,"purchasePrice":7500,"initialStock":5}"""));
        String case_ = id(call(post("/api/products"), """
                {"reference":"COQ","name":"Coque MagSafe","salePrice":200,"purchasePrice":80,"initialStock":30}"""));
        String karim = id(call(post("/api/customers"), "{\"name\":\"Karim Alaoui\",\"phone\":\"0661223344\"}"));
        call(post("/api/sales"), """
                {"customerId":"%s","amountPaid":5000,"lines":[{"productId":"%s","quantity":1},{"productId":"%s","quantity":2}]}"""
                .formatted(karim, phone, case_));
        call(post("/api/sales"), """
                {"lines":[{"productId":"%s","quantity":3}]}""".formatted(case_));
        call(post("/api/expenses"), "{\"category\":\"RENT\",\"amount\":3000,\"expenseDate\":\"" + java.time.LocalDate.now() + "\"}");

        byte[] xlsx = mvc.perform(get("/api/reports/export/excel").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsByteArray();

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            List<String> names = new ArrayList<>();
            wb.forEach(s -> names.add(s.getSheetName()));
            assertThat(names).containsExactly("Synthèse", "Ventes", "Détail des ventes", "Produits", "Clients",
                    "Achats par client", "Dépenses", "Achats fournisseurs");

            // Toutes les formules (totaux, marges) se calculent sans erreur
            FormulaEvaluator evaluator = wb.getCreationHelper().createFormulaEvaluator();
            for (Sheet sheet : wb) {
                for (Row row : sheet) {
                    for (Cell cell : row) {
                        if (cell.getCellType() == CellType.FORMULA) {
                            assertThat(evaluator.evaluate(cell).getCellType()).as(sheet.getSheetName() + "!" + cell.getAddress()).isEqualTo(CellType.NUMERIC);
                        }
                    }
                }
            }

            Sheet sales = wb.getSheet("Ventes");
            assertThat(sales.getLastRowNum()).isEqualTo(3); // 2 ventes + ligne TOTAL
            assertThat(evaluator.evaluate(sales.getRow(3).getCell(11)).getNumberValue()).isEqualTo(10000.0);

            Sheet customers = wb.getSheet("Clients");
            assertThat(customers.getRow(1).getCell(0).getStringCellValue()).isEqualTo("Karim Alaoui");
            assertThat(customers.getRow(1).getCell(7).getNumericCellValue()).isEqualTo(4400.0); // dette
            assertThat(customers.getRow(1).getCell(10).getStringCellValue()).contains("Coque MagSafe ×2", "iPhone 15 (128 Go) ×1");

            Sheet byCustomer = wb.getSheet("Achats par client");
            assertThat(byCustomer.getLastRowNum()).isEqualTo(3); // 2 produits + TOTAL
            assertThat(byCustomer.getRow(1).getCell(3).getStringCellValue()).isEqualTo("iPhone 15 (128 Go)");

            Sheet products = wb.getSheet("Produits");
            assertThat(products.getRow(1).getCell(1).getStringCellValue()).isEqualTo("iPhone 15 (128 Go)");
            assertThat(evaluator.evaluate(products.getRow(1).getCell(7)).getNumberValue()).isEqualTo(1500.0); // marge

            assertThat(wb.getSheet("Dépenses").getRow(1).getCell(1).getStringCellValue()).isEqualTo("Loyer");
        }
    }

    private static String id(String body) throws Exception {
        return new ObjectMapper().readTree(body).get("id").asText();
    }

    private String call(MockHttpServletRequestBuilder request, String body) throws Exception {
        MockHttpServletRequestBuilder r = token != null ? request.header("Authorization", "Bearer " + token) : request;
        var result = mvc.perform(r.contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse();
        assertThat(result.getStatus()).as(result.getContentAsString(StandardCharsets.UTF_8)).isBetween(200, 201);
        return result.getContentAsString(StandardCharsets.UTF_8);
    }
}
