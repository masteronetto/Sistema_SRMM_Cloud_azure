#!/bin/bash

# Script para inicializar la base de datos en orden correcto
# Se ejecuta automáticamente cuando Docker inicia

set -e

echo "📋 Ejecutando scripts de inicialización de BD..."

# 1. Crear esquema principal y vistas
echo "  1️⃣  Creando esquema principal (001_bdd.sql)..."
psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/001_bdd.sql

# 2. Migraciones incrementales
if [ -f /docker-entrypoint-initdb.d/002_logistica_eventos.sql ]; then
	echo "  2️⃣  Aplicando migración logística (002_logistica_eventos.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/002_logistica_eventos.sql
else
	echo "  2️⃣  002_logistica_eventos.sql no encontrado, se omite"
fi

# 3. Relación maquinaria-operador
if [ -f /docker-entrypoint-initdb.d/003_maquinaria_operadores.sql ]; then
	echo "  3️⃣  Aplicando relación maquinaria-operador (003_maquinaria_operadores.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/003_maquinaria_operadores.sql
else
	echo "  3️⃣  003_maquinaria_operadores.sql no encontrado, se omite"
fi

# 4. Vinculo incidencias con ordenes de trabajo
if [ -f /docker-entrypoint-initdb.d/004_incidencias_orden_trabajo.sql ]; then
	echo "  4️⃣  Aplicando vínculo incidencias-ordenes (004_incidencias_orden_trabajo.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/004_incidencias_orden_trabajo.sql
else
	echo "  4️⃣  004_incidencias_orden_trabajo.sql no encontrado, se omite"
fi

# 5. Vinculo logística con contratos de arriendo
if [ -f /docker-entrypoint-initdb.d/005_logistica_arriendo_link.sql ]; then
	echo "  5️⃣  Aplicando vínculo logística-arriendo (005_logistica_arriendo_link.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/005_logistica_arriendo_link.sql
else
	echo "  5️⃣  005_logistica_arriendo_link.sql no encontrado, se omite"
fi

# 6. Validación horómetro no decreciente
if [ -f /docker-entrypoint-initdb.d/006_horometro_no_decreciente.sql ]; then
	echo "  6️⃣  Aplicando validación de horómetro no decreciente (006_horometro_no_decreciente.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/006_horometro_no_decreciente.sql
else
	echo "  6️⃣  006_horometro_no_decreciente.sql no encontrado, se omite"
fi

# 7. Estado activo/inactivo de usuarios
if [ -f /docker-entrypoint-initdb.d/007_usuario_activo.sql ]; then
	echo "  7️⃣  Aplicando estado activo de usuarios (007_usuario_activo.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/007_usuario_activo.sql
else
	echo "  7️⃣  007_usuario_activo.sql no encontrado, se omite"
fi

# 8. Auditoría de cambios de usuarios
if [ -f /docker-entrypoint-initdb.d/008_auditoria_usuarios.sql ]; then
	echo "  8️⃣  Aplicando auditoría de usuarios (008_auditoria_usuarios.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/008_auditoria_usuarios.sql
else
	echo "  8️⃣  008_auditoria_usuarios.sql no encontrado, se omite"
fi

# 9. Registro de intentos de recuperación
if [ -f /docker-entrypoint-initdb.d/009_intentos_recuperacion.sql ]; then
	echo "  9️⃣  Aplicando intentos de recuperación (009_intentos_recuperacion.sql)..."
	psql -U postgres -d srmm_db -f /docker-entrypoint-initdb.d/009_intentos_recuperacion.sql
else
	echo "  9️⃣  009_intentos_recuperacion.sql no encontrado, se omite"
fi

echo "✅ Base de datos inicializada correctamente"
