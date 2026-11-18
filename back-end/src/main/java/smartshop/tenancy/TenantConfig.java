package smartshop.tenancy;

import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.UUID;

/**
 * Plusieurs boutiques dans la même base : chaque table métier a une colonne shop_id (@TenantId).
 * Hibernate la remplit à l'enregistrement et filtre toutes les requêtes sur la boutique en cours.
 */
@Configuration
public class TenantConfig {

    static class Resolver implements CurrentTenantIdentifierResolver<UUID> {
        @Override
        public UUID resolveCurrentTenantIdentifier() {
            return TenantContext.current().orElse(TenantContext.ROOT);
        }

        @Override
        public boolean validateExistingCurrentSessions() {
            return false;
        }

        @Override
        public boolean isRoot(UUID tenantId) {
            return TenantContext.ROOT.equals(tenantId);
        }
    }

    @Bean
    HibernatePropertiesCustomizer tenantResolver() {
        return properties -> properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, new Resolver());
    }
}
