# Mettre SmartShop en ligne

Tant que le serveur tourne sur ton PC, l'application ne marche que sur le même Wi-Fi.
Une fois en ligne, elle marche partout (4G, autre boutique, à la maison), et la **boutique en ligne**
(`/shop/{ta-boutique}`) et le **QR code des factures** deviennent accessibles à tes clients.

Trois façons de faire, de la plus simple à la plus économique :

| | Render (le plus simple) | VPS + Docker | PC de la boutique + Docker |
|---|---|---|---|
| Difficulté | ★☆☆ | ★★☆ | ★★☆ |
| Coût indicatif | ~7 $ serveur + ~6 $ base / mois | ~5 € / mois (Hetzner, OVH, Contabo…) | gratuit |
| HTTPS | automatique | à configurer (Caddy, ci-dessous) | via un tunnel (Cloudflare) |
| Accessible si le PC est éteint | oui | oui | non |

---

## Option 1 — Render (recommandé pour commencer)

1. Crée un compte sur <https://render.com> (connexion avec GitHub).
2. **New +** → **Blueprint** → choisis le dépôt `Smart-Shop`, branche `feature/new-design` (ou `main` après fusion).
   Render lit `render.yaml` et crée la base PostgreSQL + le serveur. Le secret JWT est généré tout seul.
3. Attends la fin du déploiement (5 à 10 min la première fois), puis copie l'adresse du service,
   par exemple `https://smartshop-abcd.onrender.com`.
4. Dans le service → **Environment** → `APP_PUBLIC_URL` = cette adresse → **Save** (redéploiement automatique).
5. Vérifie : `https://smartshop-abcd.onrender.com/actuator/health` doit afficher `{"status":"UP"}`.

> Le plan gratuit de Render met le serveur en veille et supprime la base au bout de 30 jours :
> à éviter pour de vraies ventes. Les plans `starter` / `basic-256mb` du fichier sont les moins chers sans ces limites.

**Récupérer tes données actuelles** : dans l'application connectée à l'ancien serveur,
Plus → Sauvegardes → *Sauvegarder maintenant* → télécharger le fichier. Connecte ensuite l'application
au nouveau serveur, crée le compte propriétaire, puis *Restaurer depuis un fichier*.

---

## Option 2 — VPS avec Docker

Sur un serveur Ubuntu avec Docker installé (`curl -fsSL https://get.docker.com | sh`) :

```bash
git clone https://github.com/oualid-latifi/Smart-Shop.git && cd Smart-Shop
git checkout feature/new-design
cp .env.docker.example .env
nano .env          # mots de passe, JWT_SECRET (openssl rand -base64 48), APP_PUBLIC_URL
docker compose up -d --build
```

Le serveur répond sur le port 8080. Pour le HTTPS avec un nom de domaine (ex. `smartshop.ma` pointé vers l'IP du VPS),
le plus simple est **Caddy**, qui obtient le certificat tout seul :

```bash
sudo apt install -y caddy
echo 'smartshop.ma {
  reverse_proxy localhost:8080
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Mise à jour après un nouveau commit : `git pull && docker compose up -d --build`.

---

## Option 3 — PC de la boutique

Même chose que l'option 2 avec Docker Desktop. Pour y accéder depuis l'extérieur sans ouvrir de port,
utilise un tunnel gratuit Cloudflare (`cloudflared tunnel --url http://localhost:8080`) qui donne une adresse `https://…`.
Le PC doit rester allumé.

---

## Variables d'environnement

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DB_URL` ou `DB_HOST` / `DB_PORT` / `DB_NAME` | oui | base PostgreSQL |
| `DB_USERNAME`, `DB_PASSWORD` | oui | accès à la base |
| `JWT_SECRET` | oui | au moins 32 caractères aléatoires — **ne jamais réutiliser l'ancien, publié sur GitHub** |
| `APP_PUBLIC_URL` | recommandé | adresse publique (QR code des factures, lien de la boutique) |
| `BACKUP_DIR`, `BACKUP_KEEP`, `BACKUP_CRON` | non | sauvegardes de la nuit (`/data/backups`, 14, 2 h 30) |
| `SPRING_MAIL_HOST`, `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `MAIL_FROM` | non | email du rapport hebdomadaire |
| `CORS_ALLOWED_ORIGINS` | non | seulement pour une interface web sur un autre domaine |
| `API_DOCS_ENABLED` | non | `false` en production (cache Swagger) |

Pour Gmail : active la validation en deux étapes puis crée un **mot de passe d'application**
(Compte Google → Sécurité) et utilise-le dans `SPRING_MAIL_PASSWORD`.

---

## L'application mobile (APK)

1. Dans `smartshop-mobile/eas.json`, remplace `https://smartshop.example.com` par l'adresse de ton serveur.
2. Installe l'outil et connecte-toi (compte gratuit sur <https://expo.dev>) :
   ```bash
   cd smartshop-mobile
   npm install -g eas-cli
   eas login
   eas init            # crée le projet Expo et ajoute son projectId dans app.json (active les notifications push)
   eas build -p android --profile apk
   ```
3. À la fin, EAS donne un lien pour télécharger l'**APK** : ouvre-le sur chaque téléphone de la boutique et installe-le.

L'adresse du serveur reste modifiable dans l'application (écran de connexion → adresse du serveur).
L'APK exige une adresse **https** : une adresse `http://192.168…` ne marche que dans Expo Go.

---

## Après la mise en ligne

- Plus → **Ma boutique** : active la boutique en ligne et le rapport du lundi.
- Plus → **Boutique en ligne** → *Partager le lien* (WhatsApp, Instagram, Facebook…).
- Plus → **Sauvegardes** : télécharge une copie de temps en temps (Drive, email) — une sauvegarde
  qui reste sur le même serveur ne protège pas d'une panne de ce serveur.

---

## Plusieurs boutiques sur le même serveur

Un seul serveur suffit pour plusieurs magasins : chaque propriétaire touche **« Nouvelle boutique ? Créer ma boutique »**
sur l'écran de connexion. Chaque boutique a ses propres produits, ventes, clients, employés, paramètres,
numéros de factures (FAC-2026-00001 dans chaque boutique), sauvegardes et boutique en ligne (`/shop/{nom-de-la-boutique}`).
Une boutique ne voit jamais les données d'une autre. Les données d'avant le passage multi-boutiques sont rattachées
automatiquement à une première boutique au démarrage du serveur.
