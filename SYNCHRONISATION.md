# Mode hors-ligne et synchronisation (SQLite ↔ PostgreSQL)

L'application continue à fonctionner **sans Internet et sans le PC serveur**. Elle garde ses données dans une
base **SQLite** sur le téléphone, puis se synchronise **automatiquement dans les deux sens** avec le serveur
Spring Boot (PostgreSQL) dès qu'il répond, **sans perte ni doublon**.

```
 Téléphone (Expo / React Native)                     Serveur (Spring Boot)
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│ Écrans (vente, clients…)     │                   │ /api/sync/push   (opérations)│
│        │ lisent / écrivent   │  ── push ──────►  │   SyncService : 1 transaction│
│ SQLite smartshop.db          │                   │   par opération, mémorisée   │
│  • records (produits,        │  ◄───── pull ──   │   dans sync_operations       │
│    clients, ventes)          │                   │ /api/sync/pull   (changements│
│  • outbox (opérations)       │                   │   depuis le curseur)         │
│  • meta (curseur, réglages)  │                   │ PostgreSQL                   │
└──────────────────────────────┘                   └──────────────────────────────┘
```

## Ce qui marche sans serveur

| Action | Hors-ligne | Détail |
|---|---|---|
| Vendre (scanner, panier, crédit, chèque…) | ✅ | stock affiché diminué tout de suite |
| Créer un client | ✅ | utilisable immédiatement dans une vente |
| Encaisser un paiement client | ✅ | dette affichée mise à jour |
| Consulter produits, clients, historique des ventes | ✅ | copie locale (500 dernières ventes) |
| Rapports, achats, inventaire, documents PDF, réglages | ❌ | nécessitent le serveur (message clair) |

## Envoi (téléphone → serveur) : jamais de doublon

1. Chaque action hors-ligne devient une **opération** dans la table `outbox`, avec un identifiant unique
   créé par le téléphone (`opId`) et l'heure réelle (`occurredAt`).
2. Les opérations partent **dans l'ordre** par lots (`POST /api/sync/push`).
3. Le serveur applique chaque opération **dans sa propre transaction** et enregistre son `opId` dans
   `sync_operations`. Si la même opération revient (réseau coupé avant la réponse), il répond `DUPLICATE`
   avec le même résultat **sans rien refaire** (même numéro de vente, stock retiré une seule fois).
4. Une vente pour un client créé hors-ligne référence l'opération du client (`customerOpId`) : le serveur
   retrouve le vrai client créé juste avant.
5. Une opération refusée (droits, données invalides…) **reste sur le téléphone** en « refusée » avec le motif :
   rien n'est perdu ; on peut la renvoyer ou la supprimer volontairement (écran *Synchronisation*).
6. La vente garde l'**heure réelle** où elle a été faite (au plus 30 jours en arrière).

## Réception (serveur → téléphone) : seulement ce qui a changé

- Produits, clients et ventes ont une colonne `updated_at`. `GET /api/sync/pull?since=<curseur>` renvoie
  ce qui a changé depuis la dernière synchronisation, plus un nouveau curseur.
- Une marge de 2 minutes évite de manquer une modification enregistrée pendant la synchronisation ;
  le téléphone remplace simplement les lignes reçues en double (`INSERT OR REPLACE`).
- Un client est renvoyé aussi quand sa **dette** change (vente, paiement, annulation).
- Si les **promotions en cours** changent (`promoKey`), tout le catalogue est renvoyé pour avoir les bons prix.
- Les données suivent les **droits du compte** (un magasinier ne reçoit ni les clients ni les marges).
  Si un autre compte se connecte sur le téléphone, la copie locale est effacée et rechargée
  (les opérations en attente sont gardées : elles partent quand le compte qui les a faites se reconnecte).

## Quand la synchronisation se lance

Au démarrage, à l'ouverture de l'écran Vente, toutes les 30 secondes, au retour dans l'application,
juste après une opération hors-ligne, et avec le bouton *Synchroniser maintenant*.

## Fichiers

- Serveur : `SyncController`, `SyncService`, `SyncOperation`, colonnes `updated_at` (Product, Customer, Sale),
  test `SyncIntegrationTest` (ordre, doublons, erreurs isolées, pull incrémental, droits).
- Téléphone : `src/db.ts` (SQLite), `src/db.web.ts` (navigateur), `src/offline.tsx` (moteur de synchronisation),
  écran `OfflineQueueScreen` (Synchronisation).
