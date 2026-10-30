# SmartShop : gestion de boutique (téléphones et accessoires)

## Lancer le projet
1. Installe Java 17 (ou plus) et PostgreSQL.
2. Crée une base vide nommée `smartshop` dans PostgreSQL.
3. Ouvre `src/main/resources/application.properties` et mets ton utilisateur et ton mot de passe PostgreSQL.
4. Lance `SmartShopApplication` (IntelliJ), ou dans un terminal : `mvn spring-boot:run`
5. Les tables sont créées automatiquement au premier lancement.

## Tester avec Postman
Importe les fichiers du dossier `postman/` puis clique sur Run :
- `1-produits-et-categories`
- `2-fournisseurs-et-achats`

## Les API
- /api/categories, /api/products
- /api/suppliers, /api/purchases
- /api/customers, /api/sales
- /api/expenses
- /api/reports (today, this-week, this-month, summary)
