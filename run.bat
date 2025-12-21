@echo off
chcp 65001 >nul
title Servicios de Desarrollo - Romerito2

echo.
echo ========================================
echo 🚀 Iniciando servicios de desarrollo...
echo ========================================
echo.

:: Crear carpeta de logs si no existe
if not exist "logs" (
    mkdir logs
    echo 📁 Carpeta 'logs' creada
)

:: Verificar que npm está disponible
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: npm no está instalado o no está en PATH
    pause
    exit /b 1
)

:: Verificar que caddy está disponible
where caddy >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: caddy no está instalado o no está en PATH
    pause
    exit /b 1
)

echo ⚡ Iniciando Express con TypeScript en puerto 3000...
start "Express Server" cmd /k "npm run dev"

:: Esperar 3 segundos para que Express inicie
timeout /t 3 /nobreak >nul

echo 🌐 Iniciando Caddy en puerto 8080...
start "Caddy Server" cmd /k "caddy run --config Caddyfile"

:: Esperar 1 segundo
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo ✅ Todos los servicios están corriendo
echo ========================================
echo.
echo 📍 URLs disponibles:
echo    • Aplicación (Caddy):  http://localhost:8080
echo    • Express (directo):   http://localhost:3000
echo.
echo 📂 Archivos estáticos servidos por Caddy:
echo    • /css/*      → ./public/css/
echo    • /js/*       → ./public/js/
echo    • /images/*   → ./public/images/
echo    • /fonts/*    → ./public/fonts/
echo    • /assets/*   → ./public/assets/
echo.
echo 📝 Logs guardados en: ./logs/access.log
echo.
echo ⚠️  Para detener los servicios:
echo    1. Cierra las ventanas de "Express Server" y "Caddy Server"
echo    2. O presiona Ctrl+C en cada ventana
echo.
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
echo (Los servicios seguirán corriendo en segundo plano)
pause >nul