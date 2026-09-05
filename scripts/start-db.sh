#!/bin/bash

# Script para iniciar PostgreSQL en Docker con la BD precargada
# Uso: bash scripts/start-db.sh

set -e

echo "🐳 Iniciando PostgreSQL en Docker..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor, instálalo primero."
    echo "Descarga desde: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Verificar si docker-compose existe
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose no está instalado."
    exit 1
fi

# Detener contenedor anterior si existe
if docker ps -a --format '{{.Names}}' | grep -q '^srmm-postgres$'; then
    echo "🛑 Limpiando contenedor anterior..."
    docker-compose down -v 2>/dev/null || true
    sleep 2
fi

# Iniciar PostgreSQL
echo "▶️  Levantando PostgreSQL en segundo plano..."
docker-compose up -d

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a que PostgreSQL inicie y la BD se inicialice..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres &>/dev/null; then
        echo "✅ PostgreSQL respondiendo..."
        break
    fi
    echo "  Intento $i/30..."
    sleep 1
done

# Esperar un poco más para que los scripts de inicialización se ejecuten
sleep 3

# Verificar que la BD se creó
if docker-compose exec -T postgres psql -U postgres -d srmm_db -c "SELECT count(*) FROM usuarios" &>/dev/null; then
    echo ""
    echo "🎉 ¡Base de datos inicializada correctamente!"
    echo ""
    echo "📋 Información de conexión:"
    echo "   Host: localhost"
    echo "   Puerto: 5432"
    echo "   Usuario: postgres"
    echo "   Contraseña: postgres"
    echo "   Base de datos: srmm_db"
    echo ""
    echo "📦 Tablas creadas:"
    docker-compose exec -T postgres psql -U postgres -d srmm_db -c "\dt"
    echo ""
    echo "💡 Próximos pasos:"
    echo "   npm run dev           # Para iniciar el servidor"
    echo "   docker-compose ps     # Ver estado de contenedores"
    echo "   docker-compose logs   # Ver logs"
    echo "   docker-compose down   # Para detener"
else
    echo "⚠️  Verificando si la BD se está inicializando..."
    docker-compose logs postgres | tail -20
    echo ""
    echo "Esperando más tiempo para la inicialización..."
    sleep 5
fi
