#!/bin/bash

# Script de utilidades para la base de datos
# Uso: bash scripts/db-utils.sh [comando]

COMMAND=$1

case $COMMAND in
  "connect")
    echo "📡 Conectando a la base de datos..."
    docker-compose exec postgres psql -U postgres -d srmm_db
    ;;
  "logs")
    echo "📋 Mostrando logs de PostgreSQL..."
    docker-compose logs -f postgres
    ;;
  "status")
    echo "📊 Estado de contenedores:"
    docker-compose ps
    ;;
  "stop")
    echo "🛑 Deteniendo los servicios..."
    docker-compose down
    ;;
  "restart")
    echo "🔄 Reiniciando PostgreSQL..."
    docker-compose restart postgres
    sleep 3
    echo "✅ PostgreSQL reiniciado"
    ;;
  "clean")
    echo "⚠️  Eliminando volumen de datos (perderás la BD)..."
    read -p "¿Estás seguro? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
      docker-compose down -v
      echo "✅ Limpiado"
    fi
    ;;
  "backup")
    BACKUP_FILE="sql/backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "💾 Realizando backup a $BACKUP_FILE..."
    docker-compose exec -T postgres pg_dump -U postgres -d srmm_db > "$BACKUP_FILE"
    echo "✅ Backup completado"
    ;;
  *)
    echo "📚 Comandos disponibles:"
    echo ""
    echo "  bash scripts/db-utils.sh connect   - Conectar a la BD con psql"
    echo "  bash scripts/db-utils.sh logs      - Ver logs de PostgreSQL"
    echo "  bash scripts/db-utils.sh status    - Ver estado de contenedores"
    echo "  bash scripts/db-utils.sh stop      - Detener los servicios"
    echo "  bash scripts/db-utils.sh restart   - Reiniciar PostgreSQL"
    echo "  bash scripts/db-utils.sh clean     - Eliminar datos (⚠️ irreversible)"
    echo "  bash scripts/db-utils.sh backup    - Hacer backup de la BD"
    echo ""
    ;;
esac
