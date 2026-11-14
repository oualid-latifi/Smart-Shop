# SmartShop

Application de gestion de boutique (téléphones et accessoires) : produits, stock, achats fournisseurs,
ventes avec crédit client, dépenses et rapports exportables en PDF / Excel.

| Dossier | Technologie |
|---|---|
| `back-end/` | API REST Spring Boot 3 (Java 17+), PostgreSQL, JWT |
| `smartshop-mobile/` | Application Expo / React Native (TypeScript), français et arabe |

## Démarrage rapide

### 1. Back-end

Prérequis : Java 17 ou plus, Maven, PostgreSQL.

```bash
cd back-end
cp .env.example .env        # puis remplir DB_PASSWORD et JWT_SECRET
mvn spring-boot:run
```

Créer d'abord une base vide `smartshop` dans PostgreSQL. Les tables sont créées au premier lancement.

| Adresse | Rôle |
|---|---|
| `http://localhost:8080/swagger-ui.html` | Documentation interactive de l'API (OpenAPI 3) |
| `http://localhost:8080/actuator/health` | État du serveur (supervision) |

### 2. Application mobile

```bash
cd smartshop-mobile
npm ci
cp .env.example .env        # EXPO_PUBLIC_API_URL = adresse du back-end
npx expo start
```

## Fonctionnalités

**Ventes et documents**
- Vente rapide (catalogue, recherche, scanner code-barres), prix négocié par ligne, remise en DH ou en %,
  vente à l'unité ou au carton.
- Documents numérotés sans trou par année : ventes `VT-`, factures `FAC-`, bons de livraison `BL-`, devis `DEV-`,
  bons de commande `BC-`, inventaires `INV-`.
- PDF A4 (facture avec HT / TVA par taux / TTC et montant en lettres, BL, devis, bon de commande,
  relevé client) et tickets thermiques 58 / 80 mm ; partage WhatsApp, impression, email.
- Devis : acceptation, refus, transformation en vente.

**Paiements et clients**
- Espèces, chèque (n°, banque, échéance), virement, carte ; ventes à crédit avec plafond par client.
- Suivi des chèques à encaisser ; un chèque impayé remet la dette du client.
- Retours clients (remise en stock ou article abîmé), avoir déduit de la dette ou remboursement.
- Relevé de compte (écran + PDF), ancienneté des créances (0-30 / 31-60 / 61-90 / +90 j), rappel WhatsApp.

**Stock et achats**
- Inventaire avec comptage, écarts en quantité et en valeur, clôture qui corrige le stock.
- Bons de commande fournisseur, réception totale ou partielle, retours fournisseur.
- Dépôts en plus de la boutique, transferts, quarantaine pour les articles abîmés / périmés.

**Équipe**
- Comptes employés avec rôles : propriétaire, vendeur, caissier, magasinier, comptable.
  Les prix d'achat et bénéfices sont masqués aux rôles qui n'ont pas à les voir.
- Journal d'activité (qui a fait quoi, quand), caisse des employés (espèces encaissées / remises),
  objectifs de vente mensuels par vendeur.
- Import des produits et clients depuis Excel (CSV), avec modèles à télécharger.

**Paramètres** : nom, adresse, ICE / IF / RC / patente imprimés sur les documents, TVA par défaut et par produit.

## Tests et qualité

```bash
cd back-end && mvn verify               # tests unitaires et d'intégration (base H2 en mémoire)
cd smartshop-mobile && npm run typecheck
```

Le workflow GitHub Actions `.github/workflows/ci.yml` lance ces vérifications à chaque push et pull request.

## Configuration

Aucun secret n'est stocké dans le code. Toutes les valeurs sensibles passent par des variables
d'environnement, décrites dans `back-end/.env.example`.

| Variable | Description |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | Connexion PostgreSQL |
| `JWT_SECRET` | Clé de signature des tokens (32 caractères minimum, aléatoire) |
| `JWT_EXPIRATION_HOURS` | Durée de validité d'une session (168 h par défaut) |
| `CORS_ALLOWED_ORIGINS` | Origines web autorisées |
| `DB_DDL_AUTO` | `update` en développement, `validate` en production |
| `API_DOCS_ENABLED` | `false` pour masquer Swagger en production |

## Standards appliqués

- **Sécurité (OWASP Top 10 / ASVS)** : secrets en variables d'environnement, mots de passe hachés avec BCrypt,
  verrouillage après 5 échecs de connexion (HTTP 429 + `Retry-After`), CORS restreint, en-têtes de sécurité,
  aucune trace technique renvoyée au client.
- **API HTTP** : codes de statut corrects (400, 401, 404, 409, 429, 500), erreurs au format
  *Problem Details* RFC 9457 (`application/problem+json`), documentation OpenAPI 3.
- **Accessibilité mobile (WCAG 2.1)** : rôles et libellés pour les lecteurs d'écran (TalkBack / VoiceOver),
  zones tactiles d'au moins 48 dp, interface en arabe (RTL) et en français.
- **Exploitation** : endpoint de santé, arrêt propre du serveur, compression HTTP.
- **Qualité** : tests automatisés, intégration continue.

## Mise en production : checklist

Guide pas à pas (Render, VPS Docker, APK Android) : **[DEPLOIEMENT.md](DEPLOIEMENT.md)**.

1. Servir l'API **uniquement en HTTPS** (reverse proxy Nginx / Caddy, ou hébergeur PaaS).
2. Définir les variables d'environnement avec des valeurs fortes et uniques.
3. Mettre `DB_DDL_AUTO=validate` et `API_DOCS_ENABLED=false`.
4. Sauvegarder régulièrement la base PostgreSQL.

Voir aussi [SECURITY.md](SECURITY.md).
