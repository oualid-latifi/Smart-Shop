-- SmartShop: suppression définitive de la fonctionnalité Catégorie.
-- Exécuter une seule fois sur PostgreSQL après mise à jour du backend.
ALTER TABLE products DROP COLUMN IF EXISTS category_id;
DROP TABLE IF EXISTS categories;
