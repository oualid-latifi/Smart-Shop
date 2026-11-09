package smartshop.entity;

public enum PaymentMethod {
    CASH,      // espèces
    CHECK,     // chèque (avec numéro, banque et date d'échéance)
    TRANSFER,  // virement bancaire
    CARD       // carte bancaire (TPE)
}
