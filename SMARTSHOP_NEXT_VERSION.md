# SmartShop – changements de la version de travail

## Frontend mobile
- La page Vente affiche maintenant le catalogue dès son ouverture, dans un ordre mélangé à chaque actualisation.
- La recherche filtre le catalogue par nom, référence, marque ou modèle.
- Un toucher sur une carte ajoute le produit au panier; les produits en rupture ne peuvent pas être ajoutés.
- Le nombre d'articles dans le panier est limité au stock disponible.
- Les cartes affichent le prix, le stock et les informations marque/modèle.
- La fiche produit accepte marque, modèle, couleur, capacité/stockage et URL d'image facultative.
- Les listes de produits affichent l'image distante si une URL a été renseignée.
- La fiche client affiche l'historique des ventes, les montants payés et les restes dus.

## Backend
- Ajout des colonnes facultatives brand, model, color, capacity et image_url sur Product. Hibernate est configuré en `ddl-auto=update` dans la configuration fournie.
- Les endpoints de création et de mise à jour des produits acceptent ces champs.
- Nouvel endpoint `GET /api/customers/{id}/sales` pour l'historique d'un client.
- Nouveaux endpoints d'export des rapports :
  - `GET /api/reports/export/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /api/reports/export/excel?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - Les dates sont facultatives; sans dates, le rapport couvre le mois en cours jusqu'à aujourd'hui.

## Choix conservés
- Barcode / Scanner supprimé.
- Owner uniquement.
- Paiement de vente avec prise en charge du crédit conservée.
- Aucun module de garantie ajouté.

## Vérifications à faire sur la machine de développement
1. Démarrer le backend et vérifier la mise à jour automatique de la table `products`.
2. Tester `GET /api/customers/{id}/sales` avec un client ayant au moins une vente.
3. Tester les deux routes d'export avec Postman et ouvrir les fichiers générés dans un lecteur PDF et Excel.
4. Dans `smartshop-mobile`, exécuter `npm install`, puis `npx tsc --noEmit` et lancer Expo sur un appareil.

Les tests d'intégration complets n'ont pas été exécutés dans l'environnement de préparation (Maven et les dépendances mobiles ne sont pas installés ici).
