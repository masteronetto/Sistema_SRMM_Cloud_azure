# Sistema SRMM

## Descripción

SRMM es una plataforma para gestionar maquinaria, mantenimiento, arriendos,
logística, usuarios y reportes. La aplicación está formada por un frontend
desarrollado con React y Vite, y un backend intermedio desarrollado con
Express.

El backend intermedio, ubicado en la carpeta `backend`, protege las
operaciones mediante Microsoft Entra ID y administra la comunicación con
PostgreSQL.

## Estructura del proyecto

El proyecto se organiza de la siguiente manera:

1. `frontend`: aplicación web desarrollada con React y Vite.
2. `backend`: backend intermedio desarrollado con Express.
3. `backend/src/domains`: módulos de negocio separados por dominio.
4. `backend/src/routes`: rutas HTTP del backend.
5. `sql`: esquema y scripts de la base de datos.
6. `infra`: archivos relacionados con la infraestructura y el despliegue.

## Patrón de desarrollo por dominio

Cada dominio del backend utiliza una estructura uniforme:

1. El archivo `dto` transforma y valida la información de entrada y salida.
2. El archivo `service` aplica las reglas de negocio.
3. El archivo `repository` consulta PostgreSQL.
4. El archivo `controller` prepara la respuesta del backend.
5. El archivo `routes` publica y protege las rutas del dominio.

Los dominios principales son:

1. Maquinaria.
2. Reportes.
3. Arriendos.
4. Logística.
5. Mantenimientos.
6. Usuarios.

## Rutas principales

El backend intermedio expone las siguientes rutas:

```text
GET /api/me
GET y otros métodos /api/maquinaria
GET y otros métodos /api/reportes
GET y otros métodos /api/arriendos
GET y otros métodos /api/mantenimientos
GET y otros métodos /api/logistica
GET y otros métodos /api/usuarios
```

La ruta `/api/me` entrega el perfil validado del usuario, junto con su
identidad, organización, permisos y roles disponibles.

## Seguridad y permisos

El backend valida los tokens emitidos por Microsoft Entra ID antes de
procesar las rutas protegidas. La validación considera el tenant, el emisor,
la audiencia, la firma, la expiración y los permisos requeridos.

Los roles configurados para la aplicación son:

1. `Administrador`.
2. `Mecanico`.
3. `Operador`.

Las rutas aplican estos roles según la operación solicitada. Por ejemplo, las
operaciones administrativas de escritura requieren el rol `Administrador`.
Las operaciones de logística pueden permitir los roles `Administrador` u
`Operador`, según la acción.

## Microsoft Entra ID

Microsoft Entra ID es el proveedor de identidad y autorización de la
aplicación. La configuración utiliza dos aplicaciones relacionadas:

1. El frontend React está registrado como una aplicación pública de tipo
   SPA, con el identificador de cliente configurado en la aplicación.
2. El backend está registrado como una API protegida con su identificador de
   aplicación correspondiente.

El frontend solicita el siguiente permiso delegado:

```text
api://27c0d23e-24ca-46d3-b804-eb0940334b2e/access_as_user
```

La integración del frontend utiliza `@azure/msal-browser` y
`@azure/msal-react` para iniciar sesión, obtener tokens, renovar la sesión y
cerrar sesión.

Para el entorno publicado se utiliza la dirección:

```text
https://srmm.duckdns.org
```

Esta dirección debe estar registrada como URI de redirección y URI de cierre
de sesión en la aplicación frontend de Microsoft Entra ID.

## Base de datos

La aplicación utiliza PostgreSQL como motor principal de lectura y escritura.
Las tablas y columnas de cada dominio deben mantenerse alineadas con los
objetos de transferencia de datos y los repositorios del backend.

La base de datos se administra mediante Docker Compose. Las credenciales y
los secretos se proporcionan mediante variables de entorno y no deben
versionarse en el repositorio.

## Ejecución local

### Frontend

Desde la carpeta principal del repositorio, ejecutar:

```bash
cd frontend
npm install
npm run dev
```

### Backend

Desde la carpeta principal del repositorio, ejecutar:

```bash
cd backend
npm install
npm run dev
```

### Base de datos

La base PostgreSQL puede iniciarse con Docker Compose. Antes de iniciar los
servicios, se deben configurar las variables de entorno requeridas para la
base de datos y para Microsoft Entra ID.

## Pruebas

La suite de pruebas se ejecuta desde la carpeta principal:

```bash
npm test
```

## Despliegue

Los archivos de infraestructura y las instrucciones específicas de
despliegue se encuentran en la carpeta `infra`. Las configuraciones
dependientes del entorno deben mantenerse fuera del código fuente cuando
contengan credenciales o secretos.
