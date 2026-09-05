#!/bin/bash

# ============================================
# Sistema SRMM - Setup Completo
# ============================================
# Este script inicializa todo el proyecto

set -e

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  Sistema SRMM - Iniciando Setup        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Paso 1: Instalar dependencias Node
echo "📦 Paso 1: Instalando dependencias..."
npm install
echo "✅ Dependencias instaladas"
echo ""

# Paso 2: Archivos ejecutables
echo "🔧 Paso 2: Preparando scripts..."
chmod +x scripts/*.sh 2>/dev/null || true
echo "✅ Scripts listos"
echo ""

# Paso 3: Iniciar Docker
echo "🐳 Paso 3: Iniciando PostgreSQL en Docker..."
echo "   (Esto puede tardar la primera vez...)"
echo ""

bash scripts/start-db.sh

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  🎉 Setup Completado Exitosamente     ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "  1️⃣  Abre OTRA terminal en este directorio"
echo ""
echo "  2️⃣  Ejecuta: npm run dev"
echo ""
echo "  3️⃣  Accede a la API en: http://localhost:3000"
echo ""
echo "💡 Comandos útiles:"
echo "   npm run db:logs        - Ver logs de BD"
echo "   npm run db:status      - Estado de contenedores"
echo "   npm run db:connect     - Conectar a psql"
echo ""
