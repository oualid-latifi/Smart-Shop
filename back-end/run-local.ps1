# Smart Shop - démarrage local du backend sous Windows PowerShell
$ErrorActionPreference = "Stop"

function Read-SecretValue([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

$maven = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $maven) {
    Write-Host "Maven n'est pas installé ou n'est pas dans PATH." -ForegroundColor Red
    Write-Host "Installez Maven et un JDK 21, puis rouvrez PowerShell."
    exit 1
}

$dbUsername = Read-Host "Utilisateur PostgreSQL [postgres]"
if ([string]::IsNullOrWhiteSpace($dbUsername)) { $dbUsername = "postgres" }

$dbPassword = Read-SecretValue "Mot de passe PostgreSQL"
$jwtSecret = Read-SecretValue "Clé JWT (minimum 32 caractères)"
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    throw "Le mot de passe PostgreSQL ne peut pas être vide."
}
if ($jwtSecret.Length -lt 32) {
    throw "La clé JWT doit contenir au moins 32 caractères."
}

try {
    $env:DB_URL = "jdbc:postgresql://localhost:5432/smartshop"
    $env:DB_USERNAME = $dbUsername
    $env:DB_PASSWORD = $dbPassword
    $env:JWT_SECRET = $jwtSecret

    Write-Host "Démarrage de Smart Shop sur http://localhost:8080 ..." -ForegroundColor Green
    Write-Host "Gardez cette fenêtre ouverte pendant l'utilisation de l'application."
    & mvn -f (Join-Path $PSScriptRoot "pom.xml") spring-boot:run
}
finally {
    Remove-Item Env:DB_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DB_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:JWT_SECRET -ErrorAction SilentlyContinue
    $dbPassword = $null
    $jwtSecret = $null
}
