# Migracion del frontend

## Implementado

- Aplicacion React/Vite en `frontend/src/`.
- Rutas: `/`, `/maquinaria`, `/historial` y `/reportes`.
- Layout y navegacion comun en `src/components/AppLayout.jsx`.
- Compuerta de acceso MSAL en `src/components/AzureGate.jsx`.
- Maquinaria migrada a cliente API centralizado.
- Historial migrado con filtros, paginacion y exportacion CSV/PDF.
- Reportes migrados con indicadores, tabla de estadisticas, grafico Chart.js e ingresos para administrador.
- Contratos BFF protegidos para maquinaria, mantenimientos y reportes.
- Componentes antiguos conservados en `frontend/scr/components/` como referencia temporal.

## Pendiente

- Configurar tenant y probar login real con Microsoft Entra ID.
- Verificar nombres finales de roles y scopes con Azure.
- Conectar repositorios cloud de maquinaria, mantenimientos y reportes.
- Comparar paridad completa con la implementacion legacy, especialmente resumen de operador y actividad por autor.
- Reemplazar datos y respuestas `501` del BFF por servicios reales.
- Eliminar `frontend/scr/components/` y las paginas estaticas de `public/` solo despues de aprobar la paridad funcional.

## Regla de trabajo

Cada modulo debe compilar, probar sus estados de carga/error y quedar respaldado en un commit antes de eliminar su equivalente legacy.
