# Sistema SRMM

Sistema de gestion para maquinaria, mantenimiento y operacion en terreno. El proyecto integra una API REST en Node.js/Express, frontend estatico y base de datos PostgreSQL.

## Tabla de contenidos

- [Descripcion general](#descripcion-general)
- [Arquitectura del proyecto](#arquitectura-del-proyecto)
- [Tecnologias](#tecnologias)
- [Requisitos](#requisitos)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Variables de entorno](#variables-de-entorno)
- [Comandos disponibles](#comandos-disponibles)
- [Modulos de la API](#modulos-de-la-api)
- [Pruebas](#pruebas)
- [Despliegue y entornos](#despliegue-y-entornos)
- [Solucion de problemas](#solucion-de-problemas)

## Descripcion general

SRMM centraliza procesos operativos relacionados con:

- Gestion de maquinaria
- Planificacion y registro de mantenimientos
- Control de incidencias
- Arriendos y logistica
- Reporteria operativa
- Alertas criticas y notificaciones en tiempo real
- Gestion de autenticacion y roles

El backend expone endpoints bajo el prefijo `/api/*` y tambien sirve frontend estatico desde `public/` o `frontend/`.

## Arquitectura del proyecto

Estructura principal del repositorio:

```text
Sistema_SRMM/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── db/
│   ├── middleware/
│   └── Entities/
├── public/
├── frontend/
├── sql/
├── scripts/
├── tests/
├── docker-compose.yml
└── package.json
```

Componentes clave:

- `src/app.js`: configuracion de Express, rutas, middleware y entrega de archivos estaticos.
- `src/server.js`: inicializacion del servidor HTTP, Socket.IO y tareas programadas.
- `src/Entities/`: organizacion por dominio (controlador, repositorio y rutas por modulo).
- `sql/`: scripts de inicializacion y evolucion de base de datos.
- `scripts/`: automatizacion para base de datos y utilidades operativas.

## Tecnologias

- Node.js
- Express
- PostgreSQL
- Socket.IO
- Docker / Docker Compose

Dependencias relevantes:

- `pg` para acceso a PostgreSQL
- `jsonwebtoken` para autenticacion JWT
- `bcryptjs` para hash de contrasenas
- `nodemailer` para recuperacion de cuenta por correo

## Requisitos

- Node.js 18 o superior
- npm
- Docker y Docker Compose

## Puesta en marcha local

### 1) Instalar dependencias

```bash
npm install
```

### 2) Configurar variables de entorno

```bash
cp .env.example .env
```

Ajusta valores segun tu entorno local o cloud.

### 3) Levantar base de datos local

```bash
npm run db:start
```

### 4) Iniciar API en modo desarrollo

```bash
npm run dev
```

### 5) Verificar estado del servicio

- Healthcheck API: `GET /health`
- URL local por defecto: `http://localhost:3000`

## Variables de entorno

Archivo base: `.env.example`

El prototipo nuevo funciona con la base de datos desactivada por defecto. La variable `DATABASE_ENABLED` debe cambiarse explicitamente a `true` antes de configurar una base de datos local o cloud. No se incluyen credenciales ni conexiones de Supabase en este repositorio.

Variables mas utilizadas:

| Variable | Descripcion |
| --- | --- |
| `PORT` | Puerto de la API |
| `DATABASE_ENABLED` | Habilita explicitamente la conexion a PostgreSQL (`false` por defecto) |
| `DB_HOST` | Host de PostgreSQL |
| `DB_PORT` | Puerto de PostgreSQL |
| `DB_NAME` | Nombre de base de datos |
| `DB_USER` | Usuario de base de datos |
| `DB_PASSWORD` | Contrasena de base de datos |
| `DB_SSL` | Activa conexion SSL (`true`/`false`) |
| `DATABASE_URL` | Cadena completa de conexion (opcional, prioritaria en cloud) |
| `INTERVALO_VERIFICACION_RETRASOS` | Intervalo de scheduler de retrasos en ms |
| `SMTP_USER` | Cuenta para envio de correos |
| `SMTP_PASS` | Clave/App Password del proveedor SMTP |
| `SMTP_HOST` | Host SMTP (ejemplo: `smtp.gmail.com`) |
| `SMTP_PORT` | Puerto SMTP (Gmail SSL: `465`) |
| `SMTP_SECURE` | Conexion segura SMTP (`true` para 465) |
| `SMTP_FROM` | Remitente de correos |
| `SMTP_GMAIL` | Habilita modo Gmail |
| `FRONTEND_URL` | URL publica del frontend para links de recuperacion |

## Comandos disponibles

### Aplicacion

| Comando | Descripcion |
| --- | --- |
| `npm run dev` | Inicia servidor con recarga automatica |
| `npm start` | Inicia servidor en modo normal |
| `npm test` | Ejecuta pruebas definidas en `tests/reportes.test.js` |

### Base de datos

| Comando | Descripcion |
| --- | --- |
| `npm run db:start` | Levanta PostgreSQL via scripts locales |
| `npm run db:stop` | Detiene contenedores Docker |
| `npm run db:status` | Muestra estado de contenedores |
| `npm run db:logs` | Muestra logs de PostgreSQL |
| `npm run db:connect` | Abre sesion psql en el contenedor |

### Utilidades

| Comando | Descripcion |
| --- | --- |
| `bash scripts/db-utils.sh` | Muestra ayudas de utilidades |
| `bash scripts/db-utils.sh backup` | Genera backup de base de datos |
| `bash scripts/restore-db.sh <archivo.sql>` | Restaura un backup SQL |
| `node scripts/check-route-exports.js` | Revisa exportaciones de rutas |

## Modulos de la API

Rutas disponibles por dominio (prefijo `/api`):

- `/auth`
- `/usuarios`
- `/maquinaria`
- `/mantenimientos`
- `/incidencias`
- `/historial-uso`
- `/reportes`
- `/alertas-criticas`
- `/notificaciones-tiempo-real`
- `/planes-mantencion`
- `/arriendos`
- `/logistica`
- `/role-requests`

## Pruebas

Ejecucion:

```bash
npm test
```

Actualmente el repositorio incluye pruebas orientadas a reportes:

- `tests/reportes.test.js`

## Despliegue y entornos

El backend contempla ejecucion en entornos serverless (por ejemplo Vercel):

- Si detecta entorno serverless, evita iniciar procesos en segundo plano no compatibles.
- En este prototipo la base de datos permanece deshabilitada para evitar conexiones externas accidentales.
- La futura base de datos debe configurarse mediante variables de entorno del entorno de despliegue, nunca mediante credenciales versionadas.

## Base de trabajo cloud native

La carpeta `docs/architecture.md` registra la arquitectura objetivo para la siguiente etapa: frontend React con MSAL, API Gateway, BFF protegido con JWT y servicios backend separados. El código actual se conserva como referencia funcional de maquinaria, mantenimientos, usuarios y reportes; no se considera todavía la implementación final de esa arquitectura.

## Nueva base de trabajo

- Frontend React/Vite: `frontend/`
- BFF independiente preparado para Azure AD: `backend/`
- El frontend se inicia con `npm install` y `npm run build` dentro de `frontend/`.
- El BFF se inicia con `npm install` y `npm run dev` dentro de `backend/`.
- Copia los archivos `.env.example` correspondientes cuando se vaya a configurar el entorno.

## Solucion de problemas

### PostgreSQL no inicia

```bash
npm run db:logs
npm run db:status
```

Si persiste, reinicia contenedores:

```bash
docker-compose down -v
docker-compose up -d
```

### Puerto 5432 en uso

```bash
lsof -i :5432
```

Cambia el mapeo de puertos en `docker-compose.yml` si es necesario.

### API responde 503 en rutas `/api/*`

Esto ocurre cuando la base de datos no esta configurada o no es accesible. Revisa:

- Variables de entorno de conexion
- Estado de PostgreSQL
- Conectividad de red en entorno cloud

### Error SMTP al recuperar contrasena

Para Gmail, usa App Password con verificacion en dos pasos habilitada.

Checklist recomendado:

- `SMTP_USER` debe ser el correo completo de Gmail.
- `SMTP_PASS` debe ser una App Password de 16 caracteres (sin espacios).
- `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`.
- Si usas variable `SMTP_FROM`, debe pertenecer a la cuenta autorizada por el proveedor.

## Licencia

Definir segun politica del proyecto (pendiente).
