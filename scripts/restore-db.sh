#!/bin/bash

# Script para restaurar un dump SQL en PostgreSQL Docker
# Uso: bash scripts/restore-db.sh [ruta_al_dump.sql]

DUMP_FILE="${1:-sql/backup_produccion.sql}"

if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ Error: No encontré el archivo '$DUMP_FILE'"
    echo "Uso: bash scripts/restore-db.sh [ruta_al_dump.sql]"
    echo ""
    echo "Ejemplo:"
    echo "  bash scripts/restore-db.sh sql/backup_produccion.sql"
    exit 1
fi

echo "📥 Restaurando dump desde: $DUMP_FILE"

# Restaurar en el contenedor
docker-compose exec -T postgres psql -U postgres < "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Base de datos restaurada exitosamente"
else
    echo ""
    echo "❌ Error durante la restauración"
    exit 1
fi
