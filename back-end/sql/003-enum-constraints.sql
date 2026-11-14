-- SmartShop : correction manuelle des contraintes d'enum (normalement inutile).
-- Le serveur met ces contraintes à jour tout seul au démarrage (EnumConstraintUpdater).
-- Symptôme sans correction : "Opération impossible : une donnée identique existe déjà ou est encore utilisée"
-- lors d'un retour fournisseur, d'un retour client ou d'un transfert entre dépôts.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check CHECK (
    type IS NULL OR type IN ('PURCHASE', 'SALE', 'SALE_CANCELLATION', 'ADJUSTMENT',
                             'SALE_RETURN', 'PURCHASE_RETURN', 'TRANSFER_OUT', 'TRANSFER_IN'));
