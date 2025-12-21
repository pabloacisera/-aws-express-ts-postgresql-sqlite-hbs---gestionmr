#!/bin/bash

# ==========================================================
# Script para levantar Express + Caddy (Proxy Reverso)
# ==========================================================

EXPRESS_PORT=3000
CADDY_PORT=8080
LOG_DIR="logs"
EXPRESS_PID=
CADDY_PID=

# Limpieza al salir
cleanup() {
    echo -e "\n\n🚨 Deteniendo servicios..."
    [ ! -z "$CADDY_PID" ] && kill "$CADDY_PID" 2>/dev/null
    [ ! -z "$EXPRESS_PID" ] && kill "$EXPRESS_PID" 2>/dev/null
    echo "✅ Servicios detenidos."
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "\n========================================"
echo "🚀 Iniciando Express + Caddy"
echo "========================================"

# Crear logs
mkdir -p "$LOG_DIR"
> "$LOG_DIR/caddy.log"
> "$LOG_DIR/express.log"

# Verificar comandos necesarios
if ! command -v caddy &> /dev/null; then
    echo "❌ ERROR: Caddy no está instalado."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js no está instalado."
    exit 1
fi

# Dar permisos a Caddy para usar puertos privilegiados (80, 443)
echo "🔐 Configurando permisos para Caddy..."
CADDY_PATH=$(which caddy)
if ! getcap "$CADDY_PATH" | grep -q "cap_net_bind_service"; then
    echo "⚠️  Caddy necesita permisos para usar puertos 80/443"
    sudo setcap cap_net_bind_service=+ep "$CADDY_PATH"
    echo "✅ Permisos configurados"
fi

# Validar Caddyfile
if [ -f "Caddyfile" ]; then
    if ! caddy validate --config Caddyfile --adapter caddyfile 2>/dev/null; then
        echo "❌ ERROR: Caddyfile tiene errores."
        exit 1
    fi
else
    echo "❌ ERROR: No se encuentra Caddyfile."
    exit 1
fi

# Verificar y liberar puertos (con confirmación)
for port in 80 $EXPRESS_PORT $CADDY_PORT; do
    # Verificar puerto (usando sudo para puerto 80)
    PORT_IN_USE=false
    if [ $port -eq 80 ]; then
        sudo lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 && PORT_IN_USE=true
    else
        lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 && PORT_IN_USE=true
    fi
    
    if [ "$PORT_IN_USE" = true ]; then
        echo ""
        echo "⚠️  Puerto $port está en uso:"
        if [ $port -eq 80 ]; then
            sudo lsof -i :$port
        else
            lsof -i :$port
        fi
        echo ""
        read -p "¿Deseas liberar el puerto $port? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ $port -eq 80 ]; then
                echo "🛑 Deteniendo Apache..."
                sudo systemctl stop apache2
                sleep 1
            else
                lsof -ti:$port | xargs kill -9 2>/dev/null
                sleep 1
            fi
            echo "✅ Puerto $port liberado"
        else
            echo "❌ No se puede continuar sin liberar el puerto $port"
            exit 1
        fi
    fi
done

# Verificar node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

echo "✅ Preparación completada"
echo ""

# ==========================================================
# INICIAR EXPRESS
# ==========================================================

echo "⚡ Iniciando Express (puerto $EXPRESS_PORT)..."
npm run dev > "$LOG_DIR/express.log" 2>&1 &
EXPRESS_PID=$!

echo "⏳ Esperando que Express inicie..."
sleep 3

# Verificar que el proceso de Express sigue vivo
if ! ps -p $EXPRESS_PID > /dev/null 2>&1; then
    echo "❌ Express falló al iniciar. Log:"
    tail -n 20 "$LOG_DIR/express.log"
    cleanup
    exit 1
fi

# Verificar que Express está escuchando en el puerto
EXPRESS_READY=false
for i in {1..15}; do
    if lsof -Pi :$EXPRESS_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        EXPRESS_READY=true
        echo "✅ Express escuchando en puerto $EXPRESS_PORT (PID: $EXPRESS_PID)"
        break
    fi
    sleep 1
done

if [ "$EXPRESS_READY" = false ]; then
    echo "❌ Express no responde en puerto $EXPRESS_PORT. Log:"
    tail -n 20 "$LOG_DIR/express.log"
    cleanup
    exit 1
fi

echo ""

# ==========================================================
# INICIAR CADDY
# ==========================================================

echo "🌐 Iniciando Caddy (puerto $CADDY_PORT)..."
caddy run --config Caddyfile --adapter caddyfile > "$LOG_DIR/caddy.log" 2>&1 &
CADDY_PID=$!

sleep 2

# Verificar que Caddy está corriendo
if ! ps -p $CADDY_PID > /dev/null 2>&1; then
    echo "❌ Caddy falló al iniciar:"
    cat "$LOG_DIR/caddy.log"
    cleanup
    exit 1
fi

# Verificar que Caddy escucha en el puerto (verificando tanto 8080 como 80)
CADDY_READY=false
for i in {1..10}; do
    # Verificar si Caddy escucha en 8080 o en 80 (redirección HTTPS)
    if lsof -Pi :$CADDY_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || sudo lsof -Pi :80 -sTCP:LISTEN -t >/dev/null 2>&1; then
        CADDY_READY=true
        echo "✅ Caddy escuchando en puerto $CADDY_PORT (PID: $CADDY_PID)"
        break
    fi
    sleep 1
done

if [ "$CADDY_READY" = false ]; then
    echo "❌ Caddy no responde:"
    cat "$LOG_DIR/caddy.log"
    cleanup
    exit 1
fi

echo ""

# ==========================================================
# RESUMEN
# ==========================================================

echo "========================================"
echo "✅ SERVICIOS ACTIVOS"
echo "========================================"
echo ""
echo "🌐 URLs:"
echo "   • Express (directo): http://localhost:$EXPRESS_PORT"
echo "   • Caddy (HTTPS):     https://localhost:$CADDY_PORT"
echo "   • Caddy (HTTP):      http://localhost (redirige a HTTPS)"
echo ""
echo "🔢 PIDs:"
echo "   • Express: $EXPRESS_PID"
echo "   • Caddy:   $CADDY_PID"
echo ""
echo "📝 Logs:"
echo "   • Express: tail -f $LOG_DIR/express.log"
echo "   • Caddy:   tail -f $LOG_DIR/caddy.log"
echo ""
echo "⚠️  Presiona Ctrl+C para detener ambos servicios"
echo "========================================"
echo ""

# Mostrar logs en tiempo real
tail -f "$LOG_DIR/caddy.log" "$LOG_DIR/express.log"