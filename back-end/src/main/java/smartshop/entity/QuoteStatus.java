package smartshop.entity;

public enum QuoteStatus {
    PENDING,    // envoyé, en attente de réponse
    ACCEPTED,   // accepté par le client
    REJECTED,   // refusé
    CONVERTED,  // transformé en vente
    EXPIRED     // calculé : en attente mais date de validité dépassée (jamais stocké)
}
