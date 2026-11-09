package smartshop.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

/** Documentation de l'API visible sur /swagger-ui.html (bouton "Authorize" pour coller le token). */
@Configuration
@OpenAPIDefinition(
        info = @Info(title = "SmartShop API", version = "1.0",
                description = "Gestion de boutique : produits, stock, achats, ventes, clients, dépenses et rapports"),
        security = @SecurityRequirement(name = "bearerAuth"))
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {
}
