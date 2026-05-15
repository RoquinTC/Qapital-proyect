@echo off
chcp 65001 >nul
title Aura IA — Iniciar
echo ============================================================
echo   Aura IA — Modo Bajo Demanda
echo ============================================================
echo.
echo Este script inicia Aura IA + Ollama solo cuando lo necesitas.
echo Cuando termines, los contenedores se detendrán para liberar
echo recursos del PC.
echo.
echo Opciones:
echo   1) Aura con Ollama NATIVO (recomendado si tienes GPU)
echo   2) Aura con Ollama DOCKER (solo CPU, más lento)
echo   3) Detener Aura y liberar recursos
echo   4) Salir
echo.

set /p choice="Elige una opción (1-4): "

if "%choice%"=="1" goto native
if "%choice%"=="2" goto docker
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto end

:native
echo.
echo [Modo Nativo] Verificando Ollama nativo...
where ollama >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Ollama no está instalado nativamente.
    echo   Descárgalo de: https://ollama.com/download
    echo   Después de instalar, descarga los modelos:
    echo     ollama pull gemma4:e2b
    echo     ollama pull qwen2.5-coder:7b
    echo     ollama pull deepseek-r1:1.5b
    echo     ollama pull llama3.2:1b
    echo.
    goto end
)

echo ✅ Ollama nativo encontrado
echo Iniciando Ollama...
start "Ollama Server" ollama serve

echo Esperando a que Ollama esté listo...
timeout /t 5 /nobreak >nul

echo Iniciando Aura IA (conectando a Ollama nativo)...
cd /d "%~dp0.."
docker compose -f docker-compose.aura-native.yml up -d

echo.
echo ✅ Aura IA está corriendo (Ollama nativo + GPU)
echo.
echo Para detener: ejecuta este script y elige opción 3
echo O manualmente: docker compose -f docker-compose.aura-native.yml down
echo.
pause
goto end

:docker
echo.
echo [Modo Docker] Iniciando Aura IA + Ollama en contenedores...
echo ⚠️  Ollama en Docker solo usa CPU — será más lento.
echo.
cd /d "%~dp0.."
docker compose -f docker-compose.aura.yml up -d

echo.
echo ✅ Aura IA está corriendo (Ollama en Docker, solo CPU)
echo.
echo Para detener: ejecuta este script y elige opción 3
echo O manualmente: docker compose -f docker-compose.aura.yml down
echo.
pause
goto end

:stop
echo.
echo Deteniendo Aura IA y Ollama...

cd /d "%~dp0.."

REM Detener contenedores Aura Docker
docker compose -f docker-compose.aura.yml down 2>nul
docker compose -f docker-compose.aura-native.yml down 2>nul

REM Detener Ollama nativo si está corriendo
taskkill /f /im ollama.exe >nul 2>&1
taskkill /f /im "ollama app.exe" >nul 2>&1

echo.
echo ✅ Aura IA detenida. Recursos liberados.
echo.
pause
goto end

:end
