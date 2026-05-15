# ============================================================
# Quid + Cloudflare Tunnel - Script de Instalacion
# ============================================================
# Configura Cloudflare Tunnel para que tu app Quid sea
# accesible desde internet con un dominio real, sin abrir
# puertos en tu router.
#
# Requisitos:
#   - Windows 10/11 con PowerShell 5.1+
#   - Docker Desktop instalado y corriendo
#   - Cuenta gratuita en Cloudflare
#   - Dominio propio agregado en Cloudflare
#
# Ejecutar como Administrador
# ============================================================

param(
    [string]$TunnelName = "quid-tunnel",
    [string]$Domain = "quid.roquintc.app"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Quid + Cloudflare Tunnel - Configuracion" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ---- Paso 1: Verificar Docker ----
Write-Host "[1/7] Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerOk = docker info 2>&1 | Select-String "Server Version"
    if (-not $dockerOk) {
        Write-Host "  [X] Docker no esta corriendo. Inicia Docker Desktop primero." -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Docker esta corriendo" -ForegroundColor Green
} catch {
    Write-Host "  [X] Docker no esta instalado o no esta en el PATH" -ForegroundColor Red
    exit 1
}

# ---- Paso 2: Verificar cloudflared ----
Write-Host "[2/7] Verificando cloudflared..." -ForegroundColor Yellow
$cloudflaredPath = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not $cloudflaredPath) {
    Write-Host "  Descargando cloudflared..." -ForegroundColor White

    $zipUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi"
    $msiPath = "$env:TEMP\cloudflared.msi"

    Write-Host "  Descargando desde $zipUrl..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $zipUrl -OutFile $msiPath -UseBasicParsing

    Write-Host "  Instalando cloudflared..." -ForegroundColor White
    Start-Process msiexec.exe -ArgumentList "/i `"$msiPath`" /quiet /norestart" -Wait

    # Refrescar PATH
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = $machinePath + ";" + $userPath
    $cloudflaredPath = Get-Command cloudflared -ErrorAction SilentlyContinue

    if (-not $cloudflaredPath) {
        Write-Host "  [!] cloudflared instalado pero no en PATH. Reinicia PowerShell y ejecuta de nuevo." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  [OK] cloudflared instalado correctamente" -ForegroundColor Green
} else {
    Write-Host "  [OK] cloudflared ya esta instalado: $($cloudflaredPath.Source)" -ForegroundColor Green
}

# ---- Paso 3: Login a Cloudflare ----
Write-Host ""
Write-Host "[3/7] Autenticando con Cloudflare..." -ForegroundColor Yellow
Write-Host "  Se abrira tu navegador para autorizar cloudflared." -ForegroundColor White
Write-Host "  Selecciona tu dominio roquintc.app en Cloudflare y aprueba." -ForegroundColor White
Write-Host ""

cloudflared tunnel login

# ---- Paso 4: Crear el tunel ----
Write-Host ""
Write-Host "[4/7] Creando tunel '$TunnelName'..." -ForegroundColor Yellow

$tunnelList = cloudflared tunnel list 2>&1
$existingTunnel = $tunnelList | Select-String $TunnelName

if ($existingTunnel) {
    Write-Host "  [!] El tunel '$TunnelName' ya existe, usandolo..." -ForegroundColor Yellow
} else {
    cloudflared tunnel create $TunnelName
    Write-Host "  [OK] Tunel '$TunnelName' creado" -ForegroundColor Green
}

# Obtener el ID del tunel
$tunnelInfo = cloudflared tunnel list 2>&1
$tunnelId = ($tunnelInfo | Select-String $TunnelName | Select-Object -First 1).ToString().Trim().Split()[0]
Write-Host "  Tunnel ID: $tunnelId" -ForegroundColor Gray

# ---- Paso 5: Verificar dominio ----
Write-Host ""
Write-Host "[5/7] Configurando dominio..." -ForegroundColor Yellow
Write-Host "  Dominio: $Domain" -ForegroundColor White

# ---- Paso 6: Crear configuracion del tunel ----
Write-Host ""
Write-Host "[6/7] Creando archivo de configuracion..." -ForegroundColor Yellow

$configDir = "$env:USERPROFILE\.cloudflared"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}

$configFile = "$configDir\config.yml"

$configContent = @"
# Quid Cloudflare Tunnel - Configuracion
# Dominio: $Domain
# Iniciar con: cloudflared tunnel run $TunnelName

tunnel: $tunnelId
credentials-file: $configDir\$tunnelId.json

ingress:
  - hostname: $Domain
    service: http://localhost:5678
  - service: http_status:404
"@

Set-Content -Path $configFile -Value $configContent -Encoding UTF8
Write-Host "  [OK] Configuracion guardada en: $configFile" -ForegroundColor Green

# Crear el registro DNS CNAME
Write-Host "  Creando registro CNAME en Cloudflare..." -ForegroundColor White
cloudflared tunnel route dns $TunnelName $Domain
Write-Host "  [OK] Registro DNS creado: $Domain -> tunnel $TunnelName" -ForegroundColor Green

# ---- Paso 7: Crear scripts de inicio ----
Write-Host ""
Write-Host "[7/7] Creando scripts de inicio..." -ForegroundColor Yellow

$scriptsDir = "$env:USERPROFILE\Desktop\Quid-Scripts"
if (-not (Test-Path $scriptsDir)) {
    New-Item -ItemType Directory -Path $scriptsDir | Out-Null
}

# --- Script: Iniciar Quid Tunnel ---
$tunnelScript = @"
@echo off
title Quid Tunnel
echo ============================================================
echo   Quid + Cloudflare Tunnel
echo ============================================================
echo.
echo Iniciando tunnel para $Domain...
echo NO cierres esta ventana mientras uses la app.
echo.
cloudflared tunnel run $TunnelName
echo.
echo Tunnel detenido.
pause
"@

Set-Content -Path "$scriptsDir\iniciar-quid-tunnel.bat" -Value $tunnelScript -Encoding ASCII

# --- Script: Instalar Tunnel como Servicio de Windows ---
$serviceScript = @"
@echo off
title Instalar Quid Tunnel como Servicio
echo ============================================================
echo   Quid Tunnel - Instalar como Servicio de Windows
echo ============================================================
echo.
echo Esto instalara cloudflared como servicio de Windows.
echo El tunnel arrancara automaticamente con el PC.
echo Se necesita ejecutar como Administrador.
echo.
pause

cloudflared service install
net start Cloudflared

echo.
echo [OK] Servicio instalado y arrancado.
echo El tunnel se iniciara automaticamente con Windows.
echo.
echo Para detener:  net stop Cloudflared
echo Para desinstalar: cloudflared service uninstall
echo.
pause
"@

Set-Content -Path "$scriptsDir\instalar-tunnel-servicio.bat" -Value $serviceScript -Encoding ASCII

Write-Host "  [OK] Scripts creados en: $scriptsDir" -ForegroundColor Green

# ---- Resumen ----
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  [OK] Configuracion completada!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  MODO: Dominio Propio ($Domain)" -ForegroundColor White
Write-Host ""
Write-Host "  Para usar Quid como app real:" -ForegroundColor White
Write-Host "  1. Ejecuta: $scriptsDir\iniciar-quid-tunnel.bat" -ForegroundColor Yellow
Write-Host "  2. Abre https://$Domain en tu celular" -ForegroundColor Yellow
Write-Host "  3. Agrega a pantalla de inicio (funciona como app nativa)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para que el tunnel arranque con Windows:" -ForegroundColor White
Write-Host "  Ejecuta como Admin: $scriptsDir\instalar-tunnel-servicio.bat" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Quid App:       http://localhost:5678" -ForegroundColor White
Write-Host "  Tunnel config:  $configFile" -ForegroundColor Gray
Write-Host ""
