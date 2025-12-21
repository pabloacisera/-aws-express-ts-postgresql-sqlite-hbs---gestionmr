#!/bin/bash

echo "🔍 DIAGNÓSTICO DEL SISTEMA"
echo "========================================"
echo ""

# 1. Verificar comandos instalados
echo "1️⃣ Comandos instalados:"
echo "   npm:   $(command -v npm &> /dev/null && echo '✅' || echo '❌') $(npm --version 2>/dev/null)"
echo "   node:  $(command -v node &> /dev/null && echo '✅' || echo '❌') $(node --version 2>/dev/null)"
echo "   caddy: $(command -v caddy &> /dev/null && echo '✅' || echo '❌') $(caddy version 2>/dev/null | head -n 1)"
echo ""

# 2. Verificar archivos de configuración
echo "2️⃣ Archivos de configuración:"
echo "   package.json: $([ -f package.json ] && echo '✅' || echo '❌')"
echo "   Caddyfile:    $([ -f Caddyfile ] && echo '✅' || echo '❌')"
echo "   tsconfig.json: $([ -f tsconfig.json ] && echo '✅' || echo '❌')"
echo ""

# 3. Verificar puertos
echo "3️⃣ Puertos en uso:"
echo "   Puerto 3000: $(lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 && echo '❌ EN USO' || echo '✅ LIBRE')"
echo "   Puerto 8080: $(lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 && echo '❌ EN USO' || echo '✅ LIBRE')"
echo ""

# 4. Verificar contenido de package.json
echo "4️⃣ Scripts en package.json:"
if [ -f package.json ]; then
    echo "   dev: $(cat package.json | grep -A 1 '"dev"' | tail -n 1)"
else
    echo "   ❌ No se encontró package.json"
fi
echo ""

# 5. Verificar Caddyfile
echo "5️⃣ Contenido de Caddyfile:"
if [ -f Caddyfile ]; then
    cat Caddyfile
else
    echo "   ❌ No se encontró Caddyfile"
fi
echo ""

# 6. Verificar logs si existen
echo "6️⃣ Logs existentes:"
if [ -d logs ]; then
    echo "   Express log:"
    [ -f logs/express.log ] && tail -n 10 logs/express.log || echo "   (vacío)"
    echo ""
    echo "   Caddy log:"
    [ -f logs/caddy.log ] && tail -n 10 logs/caddy.log || echo "   (vacío)"
else
    echo "   ❌ No existe la carpeta logs"
fi
echo ""

# 7. Probar comando npm run dev
echo "7️⃣ Probando comando 'npm run dev' por 3 segundos..."
timeout 3 npm run dev > /tmp/test-express.log 2>&1 &
TEST_PID=$!
sleep 3
kill $TEST_PID 2>/dev/null
echo "   Salida:"
cat /tmp/test-express.log
echo ""

echo "========================================"
echo "✅ Diagnóstico completado"
echo "========================================"