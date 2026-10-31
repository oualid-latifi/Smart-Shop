# Configuration du backend SmartShop

## Prerequis
- Java 21
- Maven (ou le wrapper Maven du projet)
- PostgreSQL en cours d'execution
- Une base PostgreSQL nommee `smartshop`

## Variables d'environnement obligatoires

Le backend ne contient plus de mot de passe PostgreSQL ni de cle JWT en dur.
Definir ces variables **avant** de lancer Spring Boot :

### Windows PowerShell
```powershell
$env:DB_URL = "jdbc:postgresql://localhost:5432/smartshop"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "VOTRE_MOT_DE_PASSE_POSTGRES"
$env:JWT_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
$env:CORS_ALLOWED_ORIGINS = "*"
```

Puis lancer le backend depuis le dossier `back-end` :

```powershell
.\mvnw.cmd spring-boot:run
```

Si Maven est installe globalement, utiliser `mvn spring-boot:run`.

### Linux / macOS
```bash
export DB_URL="jdbc:postgresql://localhost:5432/smartshop"
export DB_USERNAME="postgres"
export DB_PASSWORD="VOTRE_MOT_DE_PASSE_POSTGRES"
export JWT_SECRET="$(openssl rand -base64 48)"
export CORS_ALLOWED_ORIGINS="*"
./mvnw spring-boot:run
```

## Important
- `JWT_SECRET` doit contenir au moins 32 octets aleatoires. Ne jamais reutiliser une ancienne cle exposee.
- Changer le mot de passe PostgreSQL si celui-ci a deja ete publie dans Git.
- `CORS_ALLOWED_ORIGINS=*` est pratique uniquement pour le developpement. En production, remplacer `*` par les origines web exactes, separees par des virgules.
- Le fichier `.env.example` est un modele documentaire : Spring Boot ne charge pas automatiquement un fichier `.env`. Definir les variables dans le terminal, l'IDE ou l'environnement de deploiement.
- Ne jamais committer de fichier contenant de vraies valeurs de secrets.
