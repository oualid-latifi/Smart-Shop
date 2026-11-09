package smartshop.entity;

public enum CheckStatus {
    PENDING,  // reçu, pas encore encaissé
    CASHED,   // encaissé à la banque
    BOUNCED   // impayé : le montant redevient une dette du client
}
