package smartshop.entity;

/** Droits élémentaires. Chaque rôle en regroupe plusieurs (voir Role). */
public enum Permission {
    SALES,           // vendre, devis, retours
    SALES_CANCEL,    // annuler une vente
    CUSTOMERS,       // fiches clients
    PAYMENTS,        // encaisser une dette, chèques, créances
    PRODUCTS_WRITE,  // créer / modifier les produits
    STOCK,           // inventaire, dépôts, transferts, ajustements, réception
    PURCHASES,       // achats, fournisseurs, bons de commande
    REPORTS,         // rapports et dépenses
    MARGINS,         // voir les prix d'achat, coûts et bénéfices
    CASH,            // remises de caisse des employés
    SETTINGS,        // paramètres de la boutique, import
    USERS            // gestion des comptes, journal d'activité, objectifs
}
