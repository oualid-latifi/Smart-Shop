package smartshop.entity;

import java.util.EnumSet;
import java.util.Set;

import static smartshop.entity.Permission.*;

/** Rôles des comptes. Le propriétaire a tous les droits ; les autres voient seulement leur métier. */
public enum Role {
    OWNER(EnumSet.allOf(Permission.class)),
    SELLER(EnumSet.of(SALES, CUSTOMERS)),
    CASHIER(EnumSet.of(SALES, SALES_CANCEL, CUSTOMERS, PAYMENTS)),
    STOCKKEEPER(EnumSet.of(STOCK, PRODUCTS_WRITE, PURCHASES)),
    ACCOUNTANT(EnumSet.of(REPORTS, PAYMENTS, PURCHASES, CUSTOMERS, MARGINS, CASH));

    private final Set<Permission> permissions;

    Role(Set<Permission> permissions) {
        this.permissions = permissions;
    }

    public Set<Permission> getPermissions() {
        return permissions;
    }

    public boolean has(Permission permission) {
        return permissions.contains(permission);
    }
}
