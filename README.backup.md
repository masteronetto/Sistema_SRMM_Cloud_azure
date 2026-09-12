# Sistema SRMM

SRMM es una plataforma de gestión operativa para maquinaria, mantenimientos, arriendos, logística y reportes. El repositorio combina una base funcional heredada con una nueva base cloud-native construida sobre React/Vite en el frontend y un BFF Express en la carpeta backend.

## Objetivo de la migración

La migración está orientada a dejar la capa de integración web sobre un contrato de BFF protegido con autenticación de Microsoft Entra y a mover el acceso de datos hacia PostgreSQL con un patrón de dominio consistente.

## Arquitectura objetivo

```text
frontend/                   # SPA React/Vite
+-- src/
    +-- components/

backend/                    # BFF Express protegido por Azure token
+-- src/
    +-- config/env.js
    +-- middleware/azureAuth.js
    +-- routes/
    +-- domains/
        +-- maquinaria/
        +-- reportes/
        +-- arriendos/

src/                        # legado del monolito clásico
+-- Entities/

sql/                        # scripts de base de datos y migraciones
```

## Patrón por dominio

La base nueva usa una estructura uniforme por dominio:

```text
backend/src/domains/<dominio>/
+-- <dominio>.dto.js
+-- <dominio>.service.js
+-- <dominio>.repository.js
+-- <dominio>.controller.js

backend/src/routes/<dominio>.routes.js
```

El patrón organiza la lógica así:

1. `dto`: transforma la estructura de entrada y salida.
2. `service`: aplica validaciones de negocio.
3. `repository`: consulta PostgreSQL con SQL real.
4. `controller`: responde al cliente del BFF.
5. `routes`: monta y protege el contrato con token Azure y roles.

## Dominio migrado

La migración ya dejó el siguiente patrón en fases funcionales:

- maquinaria
- reportes
- arriendos

El flujo de arriendos se prepara siguiendo la misma disciplina: DTO, servicio, repositorio, controlador y route del BFF.

## Rutas del BFF

El BFF se conecta con estas rutas principales:

```text
/api/me
/api/maquinaria
/api/reportes
/api/arriendos
/api/mantenimientos
```

El endpoint `/api/me` entrega el perfil validado con una identidad de Microsoft Entra y el conjunto de roles asociados al token.

## Roles y permisos

La capa de seguridad valida el token del usuario, su audiencia y el issuer esperado. Los roles extraídos desde el perfil del token se aplican al recurso solicitado:

- consulta pública o lectura con permisos base,
- autorización de escritura para roles con manejo administrativo,
- vista analítica y CSV adecuada al perfil del usuario.

## Datos y base PostgreSQL

La parte cloud-native usa PostgreSQL como motor principal de lectura y escritura para los contratos de dominio ya migrados. Las tablas y columnas de cada dominio deben alinearse con el DTO y el repositorio del BFF para evitar fallas de serialización o contrato.

## Frontend

El frontend en React/Vite consume el BFF con la intención de dejar una UI uniforme y compatibilizada con el perfil de roles.

## Backend

El backend bajo `backend/` tiene la misión de:

- validar el token Microsoft Entra,
- extender el perfil del usuario con roles,
- montar cada dominio con su ruta correspondiente,
- devolver respuestas JSON normalizadas,
- consultar PostgreSQL con un repositorio compatible con cada dominio.

## Estado de migración

La secuencia funcional propuesta es:

1. Maquinaria
2. Reportes
3. Arriendos
4. Logística
5. Usuarios
6. Limpieza de legacy
7. Preparación para cloud/publicación

## Entorno local

Para ejecutar el frontend localmente:

```bash
cd frontend
npm install
npm run dev
```

Para ejecutar el BFF localmente:

```bash
cd backend
npm install
npm run dev
```

La base PostgreSQL se gestiona con Docker Compose y se conecta mediante variables de entorno sin versionar secretos ni credenciales.

## Pruebas

La suite de pruebas existente se ejecuta desde la raíz:

```bash
npm test
```

## Notas

Este repositorio conserva el código legado como referencia funcional mientras la nueva base de trabajo se consolida. El documento se mantiene a nivel de arquitectura funcional y no incluye credenciales, contraseñas, tokens, endpoints privados ni detalles de acceso a la infraestructura.
