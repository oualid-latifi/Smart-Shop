# Guide de démarrage et de test LAN

Ce guide explique comment lancer Smart Shop sur un PC Windows et connecter l'application Android au backend par le même Wi-Fi. Le fonctionnement visé est local : PostgreSQL et Spring Boot tournent sur le PC, SQLite conserve les opérations sur le téléphone lorsque le serveur est inaccessible.

## 1. Préparer PostgreSQL

1. Installer et démarrer PostgreSQL sur le PC.
2. Créer une base nommée `smartshop` (par exemple depuis pgAdmin ou psql).
3. Garder PostgreSQL accessible sur `localhost:5432` : seul le backend du PC doit s'y connecter.
4. Noter le nom d'utilisateur et le mot de passe PostgreSQL.

La configuration par défaut du backend utilise :

- URL : `jdbc:postgresql://localhost:5432/smartshop`
- utilisateur : `postgres` (modifiable)
- mot de passe : fourni par la variable `DB_PASSWORD`

## 2. Configurer et lancer le backend

Prérequis : JDK 21 et Maven (ou le Maven Wrapper s'il est présent dans le dossier).

Ouvrir PowerShell dans le dossier `back-end`, puis définir les variables pour la session PowerShell courante (remplacer les valeurs d'exemple) :

```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/smartshop"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "VOTRE_MOT_DE_PASSE_POSTGRES"
$env:JWT_SECRET = "REMPLACER_PAR_UNE_CLE_ALEATOIRE_DE_32_CARACTERES_MINIMUM"
```

La clé JWT doit contenir au moins 32 caractères. Ne partagez pas ces valeurs et ne les ajoutez pas à Git.

Lancer le backend :

```powershell
.mvnw.cmd spring-boot:run
```

Si le projet ne contient pas `mvnw.cmd`, utilisez :

```powershell
mvn spring-boot:run
```

Le serveur écoute sur le port **8080**. Garder cette fenêtre ouverte pendant le test.

## 3. Vérifier le backend depuis le PC

Dans un navigateur du PC, ouvrir :

```text
http://localhost:8080/api/auth/status
```

Une réponse JSON avec le champ `accountExists` indique que le backend répond. La valeur `false` signifie qu'aucun compte n'a encore été créé ; ce n'est pas une erreur réseau.

## 4. Trouver l'adresse IPv4 du PC

1. Sur le PC, ouvrir CMD.
2. Exécuter `ipconfig`.
3. Repérer la carte **Wi-Fi** utilisée et sa ligne **Adresse IPv4**, par exemple `192.168.1.47`.
4. Ne pas utiliser `127.0.0.1` ou `localhost` dans le téléphone : ces adresses désignent le téléphone lui-même.

Le téléphone et le PC doivent être connectés au même Wi-Fi/LAN. Éviter le Wi-Fi invité ou l'isolation des appareils clients.

## 5. Autoriser le port dans le pare-feu Windows si nécessaire

Si le navigateur du PC fonctionne mais que le téléphone ne parvient pas à joindre le serveur, vérifier le pare-feu Windows. Autoriser TCP **8080** uniquement sur le profil **Privé** et uniquement pour le réseau local de confiance.

Ne désactivez pas complètement le pare-feu. Ne créez aucune redirection de port sur le routeur et n'exposez pas le backend à Internet.

## 6. Connecter l'application mobile

1. Ouvrir Smart Shop sur Android.
2. Aller dans **Plus → Connexion au PC**.
3. Saisir l'adresse sous la forme :

```text
http://ADRESSE_IPV4_DU_PC:8080
```

Exemple : `http://192.168.1.47:8080`.

4. Appuyer sur **Enregistrer et tester**.
5. Le message de réussite confirme que l'application a atteint `/api/auth/status`.

L'adresse IP de l'exemple est fictive : utiliser celle affichée par `ipconfig` sur votre PC.

## 7. Scénarios de test à effectuer

Faire d'abord les tests avec de petites données non critiques :

- [ ] Créer le compte initial et se connecter.
- [ ] Créer un produit et vérifier son stock.
- [ ] Couper le Wi-Fi du téléphone, créer une vente, puis vérifier qu'elle reste visible.
- [ ] Réactiver le Wi-Fi et lancer la synchronisation.
- [ ] Vérifier côté serveur que la vente n'a été enregistrée qu'une seule fois.
- [ ] Tester un achat, un paiement client, un paiement fournisseur, une dépense et un remboursement.
- [ ] Tester une opération en échec puis utiliser le bouton de nouvelle tentative.
- [ ] Comparer les rapports en ligne et hors ligne.
- [ ] Fermer et relancer l'application pour vérifier la persistance SQLite.

Ne pas utiliser de données comptables réelles avant d'avoir vérifié les montants, le stock et l'absence de doublons sur plusieurs cycles de déconnexion/reconnexion.

## 8. Construire l'APK Android

Depuis le dossier `smartshop-mobile` :

```bash
npm install
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Le profil `preview` dans `eas.json` est configuré pour produire un APK en distribution interne. Après le build EAS, récupérer l'APK depuis la page de build et l'installer sur le téléphone.

Avant de générer l'APK, vérifier que le projet EAS est bien lié au compte utilisé et que le PC conserve une adresse IP stable (réservation DHCP recommandée) ou mettre à jour l'adresse dans **Connexion au PC** si elle change.

## Dépannage rapide

| Symptôme | Vérification |
|---|---|
| `localhost` fonctionne sur PC mais pas sur téléphone | Utiliser l'IPv4 du PC, pas localhost |
| Délai d'attente / network error | Même Wi-Fi, IP correcte, backend démarré, pare-feu privé |
| HTTP 401 | La connexion réseau fonctionne ; reconnecter le compte si le token a expiré |
| HTTP 500 au démarrage ou pendant l'accès | Vérifier les logs Spring Boot, PostgreSQL et les variables d'environnement |
| `accountExists: false` | Le serveur répond ; créer le compte initial dans l'application |
| IP du PC change | Mettre à jour l'URL dans Connexion au PC |

## Limites du test

Ce guide prépare le test, mais ne prouve pas que le téléphone et le PC ont déjà été connectés physiquement. Il faut effectuer les scénarios ci-dessus sur vos propres appareils avant de considérer la version comme validée.
