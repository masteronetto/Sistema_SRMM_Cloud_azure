# Sistema SRMM

SRMM es una plataforma de gesti�n operativa para maquinaria, mantenimientos, arriendos, log�stica y reportes. El repositorio combina una base funcional heredada con una nueva base cloud-native construida sobre React/Vite en el frontend y un BFF Express en la carpeta backend.

## Objetivo de la migraci�n

La migraci�n est� orientada a dejar la capa de integraci�n web sobre un contrato de BFF protegido con autenticaci�n de Microsoft Entra y a mover el acceso a datos hacia PostgreSQL con un patr�n de dominio consistente.

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

src/                        # legado del monolito cl�sico
+-- Entities/

sql/                        # scripts de base de datos y migraciones
```

## Patr�n por dominio

La base nueva usa una estructura uniforme por dominio:

```text
backend/src/domains/<dominio>/
+-- <dominio>.dto.js
+-- <dominio>.service.js
+-- <dominio>.repository.js
+-- <dominio>.controller.js

backend/src/routes/<dominio>.routes.js
```

El patr�n organiza la l�gica as�:

1. `dto`: transforma la estructura de entrada y salida.
2. `service`: aplica validaciones de negocio.
3. `repository`: consulta PostgreSQL con SQL real.
4. `controller`: responde al cliente del BFF.
5. `routes`: monta y protege el contrato con token Azure y roles.

## Dominio migrado

La migraci�n ya dej� el siguiente patr�n en fases funcionales:

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

La capa de seguridad valida el token del usuario, su audiencia y el issuer esperado. Los roles extra�dos desde el perfil del token se aplican al recurso solicitado:

- consulta p�blica o lectura con permisos base,
- autorizaci�n de escritura para roles con manejo administrativo,
- vista anal�tica y CSV adecuada al perfil del usuario.

## Datos y base PostgreSQL

La parte cloud-native usa PostgreSQL como motor principal de lectura y escritura para los contratos de dominio ya migrados. Las tablas y columnas de cada dominio deben alinearse con el DTO y el repositorio del BFF para evitar fallas de serializaci�n o contrato.

## Frontend

El frontend en React/Vite consume el BFF con la intenci�n de dejar una UI uniforme y compatibilizada con el perfil de roles.

## Backend

El backend bajo `backend/` tiene la misi�n de:

- validar el token Microsoft Entra,
- extender el perfil del usuario con roles,
- montar cada dominio con su ruta correspondiente,
- devolver respuestas JSON normalizadas,
- consultar PostgreSQL con un repositorio compatible con cada dominio.

## Estado de migraci�n

La secuencia funcional propuesta es:

1. Maquinaria
2. Reportes
3. Arriendos
4. Log�stica
5. Usuarios
6. Limpieza de legacy
7. Preparaci�n para cloud/publicaci�n

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

La suite de pruebas existente se ejecuta desde la ra�z:

```bash
npm test
```

## Notas

