# Sistema SRMM

## Informe técnico del proyecto

### Resumen

El Sistema SRMM es una plataforma web para apoyar la gestión operativa de
maquinaria, mantenimientos, arriendos, logística, usuarios y reportes. La
solución utiliza una arquitectura cloud compuesta por un frontend en React y
Vite, un backend intermedio en Express, un consumidor de eventos en Spring
Boot, una base de datos PostgreSQL en Amazon RDS y servicios de mensajería
administrados mediante RabbitMQ y Docker Compose.

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

Ampliar y consolidar la arquitectura cloud del Sistema SRMM mediante
Amazon API Gateway, mensajería asíncrona con RabbitMQ y microservicios
especializados, manteniendo la autenticación y la autorización existentes y
verificando técnicamente la integración entre los componentes.

### 2.2 Objetivos específicos

1. Utilizar Amazon API Gateway como punto de entrada de las solicitudes
   dirigidas al backend.
2. Mantener una interfaz web desarrollada con React y Vite, publicada
   mediante HTTPS bajo un dominio estable.
3. Incorporar RabbitMQ para procesar eventos de manera asíncrona, incluyendo
   colas de mensajes fallidos y reintentos controlados.
4. Integrar el microservicio de notificaciones con los eventos de arriendos,
   logística y mantenimientos.
5. Implementar `rabbit-admin` para administrar colas, exchanges y bindings
   mediante endpoints protegidos.
6. Consolidar el despliegue en AWS Academy mediante una instancia EC2,
   Amazon RDS, Docker Compose y PM2.
7. Verificar la conectividad, la autenticación, la autorización, el
   procesamiento de mensajes y las pruebas automatizadas.
8. Mantener la configuración sensible fuera del código versionado.

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

1. **Frontend:** aplicación React y Vite servida mediante Nginx con HTTPS.
2. **Entrada de la API:** Amazon API Gateway concentra las solicitudes
   dirigidas al backend y sus rutas de verificación.
3. **Backend intermedio:** aplicación Express, denominada BFF, que gestiona
   las operaciones y se comunica con la base de datos.
4. **Persistencia:** PostgreSQL alojado en Amazon RDS.
5. **Mensajería:** RabbitMQ recibe y distribuye eventos mediante exchanges,
   colas, routing keys, bindings y colas de mensajes fallidos.
6. **Microservicio de notificaciones:** aplicación Spring Boot con Spring
   AMQP que consume eventos por dominio mediante `@RabbitListener`, aplica
   reintentos y deriva errores a DLQ.
7. **Microservicio `rabbit-admin`:** administra la infraestructura de
   mensajería mediante endpoints protegidos.
8. **Operación:** PM2 administra los procesos del backend y de los
   microservicios, mientras Docker Compose administra RabbitMQ.
9. **Identidad:** Microsoft Entra ID es el proveedor de autenticación y
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

En el entorno cloud, los componentes se despliegan sobre una instancia EC2
de AWS Academy. Amazon API Gateway actúa como punto de entrada de la API,
mientras Nginx se limita a servir el frontend. Esta separación evita que el
servidor web del frontend asuma también la función de proxy principal de la
API.

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

## 6. Mensajería asíncrona y microservicios

RabbitMQ permite desacoplar las operaciones principales del backend de las
tareas de notificación. El backend publica eventos asociados a arriendos,
logística y mantenimientos, y el microservicio de notificaciones los
consume de forma independiente.

La configuración de mensajería contempla exchanges, colas, routing keys,
bindings y colas de mensajes fallidos. El consumidor Spring confirma
explícitamente los mensajes procesados con ACK, deriva errores no recuperables
a DLQ mediante NACK y aplica reintentos acotados solo a errores transitorios.
Esto desacopla el consumo de eventos de la operación principal,
pero no constituye una garantía de entrega extremo a extremo: si RabbitMQ no
está disponible, el productor registra el error y el BFF conserva su
respuesta; no se encontró un patrón outbox que persista el evento para
publicarlo posteriormente.

El microservicio `rabbit-admin` proporciona endpoints para administrar
colas, exchanges y bindings. Sus entradas se validan y sus operaciones se
protegen mediante JWT y el rol `Administrador`.

La API lista recursos con `GET /queues` y `GET /exchanges`; los endpoints
`POST` declaran colas, exchanges y bindings con estado HTTP `201`. Las
consultas de recursos inexistentes responden `404`. Si RabbitMQ cierra el
canal AMQP después de un error, el servicio invalida la referencia y crea un
canal nuevo para la siguiente operación. La implementación está en
[app.js](services/rabbit-admin/src/app.js) y
[rabbit-admin.service.js](services/rabbit-admin/src/rabbit-admin.service.js).

### 6.1 Correspondencia con el requisito tecnológico

Para responder a los indicadores I2 e I4, se incorporó el microservicio
`services/notificaciones-spring`, desarrollado con Java 17, Spring Boot y
Spring AMQP. El servicio declara beans `Queue`, `TopicExchange` y `Binding`
para arriendos, logística y mantenimientos, incluidas las colas de mensajes
fallidos. Sus consumidores se implementan con `@RabbitListener` y se
organizan por dominio funcional.

El BFF y los productores de eventos existentes continúan implementados con
Express y `amqplib`; la adaptación a Spring Boot se limita al microservicio
consumidor de notificaciones. Por tanto, el requisito tecnológico se cubre
en la configuración y consumo de RabbitMQ del nuevo microservicio, pero no
implica una migración total del backend. El antiguo consumidor Node.js se
mantiene solo como referencia histórica, está marcado como obsoleto y no
debe ejecutarse. Esta solución cumple la solicitud de usar Spring Boot para
los beans y consumidores de mensajería de I2 e I4; no significa que el BFF
Express o el frontend React se hayan migrado a Spring Boot.

### 6.2 Flujo de publicación, suscripción y consumo

Los servicios de arriendos, logística y mantenimientos llaman al productor
compartido del BFF. Por ejemplo, al crear un evento logístico se publica el
resultado de la operación:

```js
const response = toLogisticaDto(created);
await publishLogisticsStateChanged({ action: 'created', ...response });
return response;
```

El nuevo servicio Spring declara los recursos del broker como beans. El
siguiente ejemplo muestra la cola durable de logística y su dead-letter
exchange:

```java
@Bean
Queue logisticsQueue() {
    return QueueBuilder.durable(RabbitTopology.LOGISTICS_QUEUE)
            .deadLetterExchange(RabbitTopology.LOGISTICS_DLX)
            .deadLetterRoutingKey(RabbitTopology.LOGISTICS_DEAD_ROUTING_KEY)
            .build();
}

@Bean
Binding logisticsBinding(
        @Qualifier("logisticsQueue") Queue queue,
        @Qualifier("logisticsExchange") TopicExchange exchange) {
    return BindingBuilder.bind(queue)
            .to(exchange)
            .with(RabbitTopology.LOGISTICS_ROUTING_KEY);
}
```

Cada dominio tiene su propio consumidor anotado. El consumidor logístico
valida `data.id_evento` y registra el evento procesado:

```java
@RabbitListener(
    queues = RabbitTopology.LOGISTICS_QUEUE,
    containerFactory = "rabbitListenerContainerFactory")
public void consume(Message message, Channel channel) throws IOException {
    messageProcessor.process(
        message, channel, RabbitTopology.LOGISTICS_QUEUE,
        RabbitTopology.LOGISTICS_EXCHANGE, RabbitTopology.LOGISTICS_ROUTING_KEY,
        () -> eventHandler.handleLogistics(message));
}
```

Los listeners reciben también el canal AMQP nativo. `NotificationMessageProcessor`
ejecuta `basicAck` al completar con éxito, envía errores de formato o validación
a la DLQ con `basicNack(..., false, false)` y reintenta como máximo tres
entregas únicamente para `TransientNotificationException`. Los errores
inesperados se registran y se rechazan sin reencolar para evitar ciclos
infinitos. Cada rechazo registra el identificador, la cola y el motivo. Los
nombres de eventos y colas permanecen compatibles con los productores actuales.

El código de referencia se encuentra en
[RabbitTopologyConfiguration.java](services/notificaciones-spring/src/main/java/cl/srmm/notificaciones/config/RabbitTopologyConfiguration.java),
[LogisticaNotificationListener.java](services/notificaciones-spring/src/main/java/cl/srmm/notificaciones/listener/LogisticaNotificationListener.java),
[NotificationEventHandler.java](services/notificaciones-spring/src/main/java/cl/srmm/notificaciones/service/NotificationEventHandler.java)
y [rabbit.publisher.js](backend/src/messaging/rabbit.publisher.js).

## 7. Seguridad y control de acceso

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

### 7.1 Integración con Microsoft Entra ID

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

## 8. Persistencia y configuración

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

## 9. Procedimiento de instalación y ejecución

### 9.1 Requisitos

Antes de iniciar el sistema se requiere disponer de:

1. Node.js y npm.
2. Java 17 con la variable `JAVA_HOME` configurada.
3. Docker Desktop con el motor Docker activo, y Docker Compose.
4. Una instancia de PostgreSQL administrada por Docker Compose o disponible
   en el entorno.
5. Una configuración válida de Microsoft Entra ID cuando se utilicen rutas
   protegidas.

### 9.2 Ejecución del frontend

Desde la carpeta principal del repositorio:

```bash
cd frontend
npm install
npm run dev
```

### 9.3 Ejecución del backend

Desde la carpeta principal del repositorio:

```bash
cd backend
npm install
npm run dev
```

### 9.4 Ejecución de los servicios locales

Se deben definir las variables de entorno requeridas y luego iniciar
Docker Compose desde la carpeta principal del proyecto. Las credenciales
deben ser valores locales o de entorno seguro y no deben incorporarse al
repositorio.

### 9.5 Compilación y ejecución del consumidor Spring Boot

Se requiere Java 17. El Maven Wrapper descarga la versión de Maven definida
por el proyecto, por lo que no es necesario instalar Maven globalmente.
RabbitMQ debe estar iniciado y accesible en la dirección configurada:

```powershell
cd services/notificaciones-spring
$env:SPRING_RABBITMQ_HOST = "localhost"
$env:SPRING_RABBITMQ_PORT = "5672"
$env:SPRING_RABBITMQ_USERNAME = "srmm"
$env:SPRING_RABBITMQ_PASSWORD = "<contraseña-local>"
.\mvnw.cmd spring-boot:run
```

Para empaquetar el servicio para PM2:

```powershell
.\mvnw.cmd -DskipTests package
```

PM2 ejecuta el artefacto `target/notificaciones-spring-0.1.0.jar`. La
configuración de proceso se encuentra en
[ecosystem.config.cjs](ecosystem.config.cjs).

Para evitar publicar credenciales, configura `SPRING_RABBITMQ_PASSWORD` en
la sesión local usando la contraseña de desarrollo antes de iniciar el
servicio. En el entorno de despliegue, PM2 recibe `RABBITMQ_USER` y
`RABBITMQ_PASSWORD` desde la configuración segura del servidor.

## 10. Pruebas y verificación

Las pruebas integradas utilizan una instancia RabbitMQ exclusiva para
pruebas, iniciada con Docker Compose en `localhost:5673`. Esta instancia es
independiente del broker local y del broker de la instancia cloud. Antes de
ejecutar la suite, confirma que Docker está activo:

```powershell
docker info
```

Define una contraseña temporal solo para el broker de pruebas. No uses aquí
la contraseña del broker de producción:

```powershell
$env:RABBITMQ_TEST_PASSWORD = "<contraseña-temporal-local>"
```

Primero inicia el broker de pruebas y espera su estado saludable:

```powershell
docker compose -f services/notificaciones-spring/docker-compose.test.yml up -d --wait
docker compose -f services/notificaciones-spring/docker-compose.test.yml ps
```

La compilación de la aplicación y las pruebas es un primer punto de evidencia:

```powershell
cd services/notificaciones-spring
.\mvnw.cmd -DskipTests test
```

Ejecuta los nueve escenarios de integración y cuatro pruebas unitarias del
procesador de mensajes:

```powershell
.\mvnw.cmd test
```

Al finalizar, detén únicamente el broker de pruebas:

```powershell
docker compose -f services/notificaciones-spring/docker-compose.test.yml down
```

La suite contiene nueve escenarios integrados: éxito y fallo no recuperable
con llegada a DLQ para cada dominio; un reintento transitorio que luego se
procesa con éxito; un error transitorio que agota tres intentos y termina en
DLQ; y JSON malformado que llega a DLQ sin reintentos. Las pruebas verifican
los metadatos `x-death` de RabbitMQ. Cuatro pruebas unitarias verifican las llamadas a
`basicAck`, `basicNack` y el comportamiento del límite de reintentos. En total,
Maven ejecuta trece pruebas.
Maven guarda los resultados de Surefire en
`services/notificaciones-spring/target/surefire-reports`.

| Dominio | Evento publicado y consumido | Fallo y DLQ | Estado de prueba integrada |
|---|---|---|---|
| Arriendos | `arriendo.creado`, con `id_contrato` | Error no recuperable enviado a su DLQ | Aprobada |
| Logística | `logistica.estado-cambiado`, con `id_evento` | Error no recuperable enviado a su DLQ | Aprobada |
| Mantenimientos | `mantenimiento.incidencia-critica`, con `id_incidencia` | Error no recuperable enviado a su DLQ | Aprobada |

El código de pruebas está en
[NotificationsIntegrationTest.java](services/notificaciones-spring/src/test/java/cl/srmm/notificaciones/NotificationsIntegrationTest.java).
Los pasos y capturas recomendadas para documentar fallos, DLQ y el evento
logístico exitoso están en
[PRUEBAS_INTEGRACION_RABBITMQ.md](docs/PRUEBAS_INTEGRACION_RABBITMQ.md).

### 10.1 Verificación del despliegue en EC2

El 29 de octubre de 2026 se ejecutó la suite integrada en la instancia
EC2: seis pruebas, cero fallos, cero errores y `BUILD SUCCESS` para la
versión desplegada en esa fecha, anterior a los cambios de ACK manual y
clasificación de errores documentados aquí. El broker
RabbitMQ de la instancia quedó saludable y se verificaron consumidores
activos en las tres colas de dominio.

PM2 mantiene activo `srmm-notificaciones-spring`; el consumidor Node.js
anterior se dejó detenido para evitar consumidores duplicados. Como prueba
de extremo a extremo, se creó un evento logístico de prueba en la aplicación
y el log de Spring confirmó su procesamiento correcto con `id_evento=5`.
La evidencia consiste en la salida de Maven, el estado de PM2 y RabbitMQ, la
confirmación del evento en la aplicación y el log del consumidor.

El estado de PM2 se guardó para su recuperación después de un reinicio. El
archivo `~/.pm2/dump.pm2` puede contener variables de entorno sensibles y se
protegió con permisos `600`; no debe copiarse ni publicarse en el repositorio.

## 11. Despliegue

Los archivos de infraestructura y las instrucciones específicas de
despliegue se encuentran en la carpeta `infra`. Antes de desplegar, se
deben revisar las variables de entorno, las URI de Microsoft Entra ID, los
permisos asignados y la conectividad con PostgreSQL y RabbitMQ.

En AWS Academy, el despliegue integral utiliza una instancia EC2, Amazon RDS
para PostgreSQL, Amazon API Gateway para la entrada de la API, Docker Compose
para RabbitMQ y PM2 para la administración de los procesos del backend y de
los microservicios. El dominio publicado del frontend es:

```text
https://srmm.duckdns.org
```

Las configuraciones de producción deben gestionarse mediante el mecanismo
seguro de secretos disponible en la plataforma de despliegue. No se deben
subir credenciales, tokens ni contraseñas al repositorio.

## 12. Conclusiones

El Sistema SRMM presenta una arquitectura modular que separa la interfaz,
la lógica de negocio, la persistencia, la mensajería y la seguridad. El
patrón por dominio facilita el mantenimiento del backend y permite ampliar
las funcionalidades de manera controlada.

La utilización de Microsoft Entra ID permite centralizar la autenticación y
aplicar permisos según el perfil del usuario. La gestión de la configuración
mediante variables de entorno reduce el riesgo de publicar información
confidencial y establece una base adecuada para ejecutar el sistema en
ambientes locales y productivos.
