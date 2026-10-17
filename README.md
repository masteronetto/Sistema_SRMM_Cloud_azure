# Sistema SRMM

## Informe técnico del proyecto

### Resumen

El Sistema SRMM es una plataforma web para apoyar la gestión operativa de
maquinaria, mantenimientos, arriendos, logística, usuarios y reportes. La
solución utiliza una arquitectura compuesta por un frontend en React y Vite,
un backend intermedio en Express, una base de datos PostgreSQL y servicios de
mensajería administrados mediante Docker Compose.

La autenticación y la autorización se implementan con Microsoft Entra ID. De
esta forma, el backend valida la identidad del usuario, los permisos del
token y los roles necesarios antes de procesar las operaciones protegidas.

## 1. Introducción

La gestión de maquinaria y de sus actividades relacionadas requiere
información centralizada, trazable y disponible para los distintos perfiles
de una organización. El Sistema SRMM aborda esta necesidad mediante una
aplicación modular que separa la presentación, las reglas de negocio, el
acceso a datos y la exposición de servicios.

Este documento presenta la organización técnica del proyecto, sus objetivos,
la arquitectura implementada, el modelo de desarrollo, las instrucciones de
ejecución y las consideraciones de seguridad y despliegue.

## 2. Objetivos

### 2.1 Objetivo general

Desarrollar una plataforma web modular para administrar información
operativa relacionada con maquinaria, mantenimiento, arriendos, logística,
usuarios y reportes.

### 2.2 Objetivos específicos

1. Proporcionar una interfaz web desarrollada con React y Vite.
2. Centralizar la lógica de negocio en un backend intermedio desarrollado con
   Express.
3. Persistir la información operativa en PostgreSQL.
4. Proteger las rutas mediante Microsoft Entra ID y control de roles.
5. Separar los módulos de negocio para facilitar el mantenimiento y la
   evolución del sistema.
6. Mantener la configuración sensible fuera del código versionado.

## 3. Alcance funcional

El sistema contempla los siguientes dominios:

1. Maquinaria.
2. Reportes.
3. Arriendos.
4. Logística.
5. Mantenimientos.
6. Usuarios.

El backend publica una interfaz HTTP para estos dominios y una ruta de
identidad del usuario autenticado:

```text
GET /api/me
GET y otros métodos /api/maquinaria
GET y otros métodos /api/reportes
GET y otros métodos /api/arriendos
GET y otros métodos /api/mantenimientos
GET y otros métodos /api/logistica
GET y otros métodos /api/usuarios
```

La ruta `/api/me` devuelve la identidad validada, la organización, los
permisos y los roles disponibles en el token del usuario.

## 4. Arquitectura de la solución

La solución se divide en las siguientes capas:

1. **Frontend:** aplicación React y Vite responsable de la interacción con
   el usuario.
2. **Backend intermedio:** aplicación Express que valida solicitudes, aplica
   reglas de negocio y expone la interfaz HTTP.
3. **Persistencia:** base de datos PostgreSQL utilizada para las operaciones
   de lectura y escritura.
4. **Mensajería:** servicios RabbitMQ utilizados para la comunicación
   asíncrona entre componentes que lo requieren.
5. **Infraestructura:** archivos de Docker Compose y configuración de
   despliegue ubicados principalmente en `infra`.
6. **Identidad:** Microsoft Entra ID como proveedor de autenticación y
   autorización.

La estructura principal del proyecto es:

```text
frontend
backend
backend/src/domains
backend/src/routes
services
sql
infra
```

## 5. Metodología de desarrollo

El backend aplica una separación por dominio y por responsabilidad. Cada
dominio sigue el flujo descrito a continuación:

1. **DTO:** transforma y valida la información de entrada y salida.
2. **Service:** aplica las reglas y validaciones de negocio.
3. **Repository:** ejecuta las consultas SQL contra PostgreSQL.
4. **Controller:** procesa la solicitud y construye la respuesta.
5. **Routes:** publica el contrato HTTP y aplica la protección de acceso.

Esta organización permite modificar un dominio sin acoplar
innecesariamente sus componentes con el resto de la aplicación.

## 6. Seguridad y control de acceso

El backend valida los tokens emitidos por Microsoft Entra ID antes de
procesar las rutas protegidas. La validación considera:

1. Tenant.
2. Emisor.
3. Audiencia.
4. Firma.
5. Fecha de expiración.
6. Permisos y alcance requerido.

Los roles definidos para la aplicación son:

1. `Administrador`.
2. `Mecanico`.
3. `Operador`.

Las operaciones administrativas de escritura requieren el rol
`Administrador`. Las operaciones de logística pueden permitir los roles
`Administrador` u `Operador`, según la acción solicitada.

### 6.1 Integración con Microsoft Entra ID

El frontend utiliza `@azure/msal-browser` y `@azure/msal-react` para iniciar
sesión, solicitar tokens, renovar la sesión y cerrar sesión. El backend
funciona como una API protegida y recibe los tokens emitidos para el
frontend.

El permiso delegado utilizado por el frontend es:

```text
api://27c0d23e-24ca-46d3-b804-eb0940334b2e/access_as_user
```

Para el entorno publicado se utiliza la dirección:

```text
https://srmm.duckdns.org
```

Esta dirección debe estar registrada como URI de redirección y URI de cierre
de sesión en la aplicación frontend de Microsoft Entra ID.

## 7. Persistencia y configuración

PostgreSQL es el motor principal de persistencia. Las tablas y columnas de
cada dominio deben mantenerse alineadas con los DTO y repositorios del
backend.

Docker Compose administra los servicios locales de PostgreSQL, RabbitMQ y
los componentes relacionados. Las contraseñas, los identificadores de
tenant, los secretos y demás valores dependientes del entorno deben
proporcionarse mediante variables de entorno.

Los archivos `.env` locales están excluidos del control de versiones. El
archivo `.env.example` sirve como referencia para conocer las variables
esperadas sin publicar credenciales reales.

## 8. Procedimiento de instalación y ejecución

### 8.1 Requisitos

Antes de iniciar el sistema se requiere disponer de:

1. Node.js y npm.
2. Docker y Docker Compose.
3. Una instancia de PostgreSQL administrada por Docker Compose o disponible
   en el entorno.
4. Una configuración válida de Microsoft Entra ID cuando se utilicen rutas
   protegidas.

### 8.2 Ejecución del frontend

Desde la carpeta principal del repositorio:

```bash
cd frontend
npm install
npm run dev
```

### 8.3 Ejecución del backend

Desde la carpeta principal del repositorio:

```bash
cd backend
npm install
npm run dev
```

### 8.4 Ejecución de los servicios locales

Se deben definir las variables de entorno requeridas y luego iniciar
Docker Compose desde la carpeta principal del proyecto. Las credenciales
deben ser valores locales o de entorno seguro y no deben incorporarse al
repositorio.

## 9. Pruebas

La suite de pruebas del proyecto se ejecuta desde la carpeta principal:

```bash
npm test
```

Los módulos que incorporan pruebas específicas también mantienen sus
pruebas junto al componente correspondiente, de acuerdo con la estructura
del proyecto.

## 10. Despliegue

Los archivos de infraestructura y las instrucciones específicas de
despliegue se encuentran en la carpeta `infra`. Antes de desplegar, se
deben revisar las variables de entorno, las URI de Microsoft Entra ID, los
permisos asignados y la conectividad con PostgreSQL y RabbitMQ.

Las configuraciones de producción deben gestionarse mediante el mecanismo
seguro de secretos disponible en la plataforma de despliegue. No se deben
subir credenciales, tokens ni contraseñas al repositorio.

## 11. Conclusiones

El Sistema SRMM presenta una arquitectura modular que separa la interfaz,
la lógica de negocio, la persistencia, la mensajería y la seguridad. El
patrón por dominio facilita el mantenimiento del backend y permite ampliar
las funcionalidades de manera controlada.

La utilización de Microsoft Entra ID permite centralizar la autenticación y
aplicar permisos según el perfil del usuario. La gestión de la configuración
mediante variables de entorno reduce el riesgo de publicar información
confidencial y establece una base adecuada para ejecutar el sistema en
ambientes locales y productivos.
