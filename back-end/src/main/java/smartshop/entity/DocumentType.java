package smartshop.entity;

/** Types de documents numérotés, avec leur préfixe (numéro final : PREFIXE-ANNÉE-00001). */
public enum DocumentType {
    SALE("VT"),
    INVOICE("FAC"),
    DELIVERY_NOTE("BL"),
    QUOTE("DEV"),
    PURCHASE_ORDER("BC"),
    INVENTORY("INV");

    private final String prefix;

    DocumentType(String prefix) {
        this.prefix = prefix;
    }

    public String getPrefix() {
        return prefix;
    }
}
