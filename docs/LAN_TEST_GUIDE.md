# Guide de démarrage et de test LAN

Ce guide explique comment lancer Smart Shop sur un PC Windows et connecter l'application Android par le même Wi-Fi. PostgreSQL et Spring Boot tournent sur le PC ; SQLite conserve les opérations sur le téléphone lorsque le serveur est inaccessible.

## 1. Préparer PostgreSQL

1. Installer et démarrer PostgreSQL sur le PC.
2. Créer une base nommée `smartshop` (par exemple depuis pgAdmin ou psql).
3. Garder PostgreSQL accessible sur `localhost:5432` : seul le backend du PC doit s'y connecter.
4. Noter le nom d'utilisateur et le mot de passe PostgreSQL.

La configuration par défaut du backend utilise l'URL `jdbc:postgresql://localhost:5432/smartshop` et l'utilisateur `postgres`. Le mot de passe est demandé au démarrage.

## 2. Installer les prérequis du backend

Installer :
- **JDK 21** ;
- **Maven** et l'ajouter au `PATH` Windows ;
- **PostgreSQL**.

Ouvrir un nouveau PowerShell et vérifier :

```powershell
java -version
mvn -version
```

## 3. Démarrer le backend

Ouvrir PowerShell dans le dossier `back-end` :

```powershell
.\run-local.ps1
```

Le script demande le nom d'utilisateur PostgreSQL, le mot de passe PostgreSQL et une clé JWT secrète d'au moins 32 caractères. Les secrets sont demandés à l'exécution et ne sont pas enregistrés dans le dépôt Git. Le serveur écoute sur le port **8080**. Garder cette fenêtre ouverte pendant le test.

Si Windows bloque l'exécution du script, ouvrir PowerShell dans le dossier du backend et exécuter pour cette fenêtre uniquement :

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run-local.ps1
```

Ne changez pas la stratégie d'exécution de façon permanente.

## 4. Vérifier le backend depuis le PC

Dans le navigateur du PC, ouvrir :

```text
http://localhost:8080/api/auth/status
```

Une réponse JSON avec le champ `accountExists` indique que le backend répond. La valeur `false` signifie qu'aucun compte n'a encore été créé ; ce n'est pas une erreur réseau.

## 5. Trouver l'adresse IPv4 du PC

1. Sur le PC, ouvrir CMD.
2. Exécuter `ipconfig`.
3. Repérer la carte **Wi-Fi** utilisée et sa ligne **Adresse IPv4**, par exemple `192.168.1.47`.
4. Ne pas utiliser `127.0.0.1` ou `localhost` dans le téléphone : ces adresses désignent le téléphone lui-même.

Le téléphone et le PC doivent être connectés au même Wi-Fi/LAN. Éviter le Wi-Fi invité ou l'isolation des appareils clients.

## 6. Autoriser le port dans le pare-feu Windows si nécessaire

Si le navigateur du PC fonctionne mais que le téléphone ne parvient pas à joindre le serveur, vérifier le pare-feu Windows. Autoriser TCP **8080** uniquement sur le profil **Privé** et uniquement pour le réseau local de confiance.

Ne désactivez pas complètement le pare-feu. Ne créez aucune redirection de port sur le routeur et n'exposez pas le backend à Internet.

## 7. Connecter l'application mobile

1. Ouvrir Smart Shop sur Android.
2. Aller dans **Plus → Connexion au PC**.
3. Saisir l'adresse `http://ADRESSE_IPV4_DU_PC:8080`, par exemple `http://192.168.1.47:8080`.
4. Appuyer sur **Enregistrer et tester**.

L'adresse IP de l'exemple est fictive : utiliser celle affichée par `ipconfig` sur votre PC.

## 8. Scénarios de test à effectuer

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

## 9. Construire l'APK Android

Depuis le dossier `smartshop-mobile` :

```bash
npm ci
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Le profil `preview` dans `eas.json` produit un APK distribuable en interne. Le projet possède déjà un identifiant EAS configuré. Le build doit être lancé avec un compte EAS auquel ce projet est accessible. Après le build EAS, récupérer l'APK depuis la page de build et l'installer sur le téléphone.

Avant le test, vérifier que le PC conserve une adresse IP stable (réservation DHCP recommandée) ou mettre à jour l'adresse dans **Connexion au PC** si elle change.

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

Ce guide prépare le test, mais ne prouve pas que le téléphone et le PC ont déjà été connectés physiquement. Effectuer les scénarios ci-dessus sur vos propres appareils avant de considérer la version comme validée.
