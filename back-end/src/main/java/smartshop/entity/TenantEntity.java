package smartshop.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import org.hibernate.annotations.TenantId;
import smartshop.exception.ResourceNotFoundException;
import smartshop.tenancy.TenantContext;

import java.util.UUID;

/**
 * Donnée appartenant à une boutique. Hibernate remplit shop_id à l'enregistrement et filtre les requêtes.
 * Le chargement par identifiant (findById) n'étant pas filtré par Hibernate, @PostLoad refuse toute ligne
 * d'une autre boutique : une boutique ne peut jamais lire les données d'une autre.
 */
@MappedSuperclass
public abstract class TenantEntity {

    @TenantId
    @Column(name = "shop_id")
    private UUID shopId;

    @PostLoad
    void checkTenant() {
        TenantContext.current().ifPresent(current -> {
            if (shopId != null && !shopId.equals(current)) {
                throw new ResourceNotFoundException("Élément introuvable");
            }
        });
    }

    public UUID getShopId() { return shopId; }
}
