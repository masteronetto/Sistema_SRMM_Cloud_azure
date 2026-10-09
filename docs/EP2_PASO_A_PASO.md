# EP2 SRMM: paso a paso

Este documento adapta la entrega EP2 a la estructura actual del repositorio. Los
valores entre `<ANGULOS>` son datos que deben completarse en cada entorno; no se
deben inventar ni versionar credenciales.

## Diagnostico inicial

- El repositorio es un monorepo con `backend/` (BFF Express 5 ESM), `frontend/`
  (React 19 + Vite), `sql/`, `docker-compose.yml` y pruebas en
  `backend/test/`.
- El BFF ya separa los dominios por DTO, servicio, repositorio, controlador y
  ruta. `backend/src/middleware/azureAuth.js` valida issuer, audience, firma,
  expiracion, scopes y roles.
- PostgreSQL ya se ejecuta en Compose como `postgres`, usando el puerto local
  `5433`. RabbitMQ, `infra/`, `services/` y PM2 todavía no existen.
- El frontend usa `VITE_API_BASE_URL` y MSAL usa variables Vite para cliente,
  tenant, scope y redirect URI.
- La rama de trabajo es `ep2-rabbitmq-gateway` y `ep1-entrega` marca el estado
  previo a esta entrega.

## Reglas comunes

- Ejecutar los comandos desde la raíz, salvo que se indique `cd backend` o
  `cd frontend`.
- Copiar los archivos `.env.example` a `.env` solo localmente. Los `.env`,
  certificados, logs, datos de Docker y tokens quedan fuera de Git.
- En AWS Academy usar `LabRole` cuando un servicio requiera un rol existente;
  no asumir permisos para crear roles IAM.
- Antes de cada commit revisar `git status --short` y confirmar que no aparecen
  secretos.

## Fase 0: preparación del repositorio

### Objetivo

Crear el punto de retorno de EP1, la rama de trabajo y la documentación de la
entrega sin cambiar el comportamiento del BFF ni del frontend.

### Archivos

- Modificar `.gitignore` para excluir `.env.*`, certificados PEM, logs y datos
  persistidos de Docker, manteniendo versionado `.env.example`.
- Crear este documento en `docs/EP2_PASO_A_PASO.md`.

### Comandos

```powershell
git tag ep1-entrega
git switch -c ep2-rabbitmq-gateway
git status --short --branch
npm test
```

Si el tag o la rama ya existen, usar `git switch ep2-rabbitmq-gateway` y no
recrearlos.

### Verificacion

`git status --short --branch` debe mostrar la rama `ep2-rabbitmq-gateway` y
ningun secreto local. `npm test` debe conservar todos los tests existentes en
verde.

### Commit

```text
chore(repo): prepare EP2 workspace
```

## Fase 1: API Gateway, S3/CloudFront, DuckDNS y Entra

### Objetivo

La arquitectura objetivo separa las entradas: API Gateway reemplaza nginx
únicamente como entrada pública del BFF, mientras nginx continúa sirviendo el
frontend en EC2. S3 quedó creado como artefacto preparado, pero CloudFront/OAC
no pudo habilitarse porque el rol AWS Academy no incluye
`cloudfront:ListDistributions` ni `cloudfront:CreateOriginAccessControl`.

### Archivos

- Crear `infra/` con scripts AWS CLI o una plantilla reproducible, sin IDs ni
  dominios reales.
- Crear `infra/.env.example` con region, bucket, distribution, API, tenant,
  issuer, audience, scope, origen CloudFront y hostname DuckDNS.
- Actualizar `frontend/.env.example` y el cliente Vite para separar la URL de
  API Gateway del fallback local.
- Crear un script de build, upload e invalidacion de CloudFront.
- Documentar el apagado de nginx y Certbot en EC2.

### Comandos

```powershell
aws sts get-caller-identity
aws configure list
Copy-Item infra\.env.example infra\.env
cd frontend
npm run build
aws s3 sync dist s3://<FRONTEND_BUCKET> --delete
aws cloudfront create-invalidation --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> --paths "/*"
```

Para HTTP API Gateway, configurar `ANY /api/{proxy+}` al origen
`http://<DUCKDNS_HOST>:3001/api/{proxy}` y `GET /health` sin autorizador.
El endpoint administrativo de RabbitMQ se añade en la Fase 4. CORS debe permitir `https://<DUCKDNS_HOST>` y, durante desarrollo,
`http://localhost:5173`. El frontend productivo permanece en
`https://<DUCKDNS_HOST>` servido por nginx.

### Obtener issuer y audience reales

No copiar valores de ejemplos. Iniciar sesión con la aplicación real y
decodificar un access token en `jwt.ms` solo para inspección local, o consultar
el campo `audience` que ya devuelve `GET /api/me`. El claim `iss` y el `aud`
de ese token son los valores del JWT authorizer. Los tokens v1 usan normalmente
`https://sts.windows.net/<TENANT_ID>/` y los v2
`https://login.microsoftonline.com/<TENANT_ID>/v2.0`; se debe aceptar la
versión emitida por la app `SRMM BFF API` según su manifiesto, sin adivinar.
Exigir `access_as_user` en `scope`.

En Entra agregar la URL HTTPS de DuckDNS como Redirect URI de tipo SPA y
mantener `http://localhost:5173` para desarrollo. Registrar también la URL de
logout si el flujo la utiliza.

### Verificacion

```powershell
curl.exe -i https://<API_ID>.execute-api.<AWS_REGION>.amazonaws.com/health
curl.exe -i https://<API_ID>.execute-api.<AWS_REGION>.amazonaws.com/api/me
```

La primera llamada debe ser `200`; la segunda, sin Bearer, debe ser `401` (o
`503` si el BFF local sigue deliberadamente sin Azure configurado). Con un
token real, issuer, audience y scope correctos, `/api/me` debe responder `200`.
La navegación directa a una ruta React debe funcionar mediante el fallback
configurado en nginx. La respuesta `/health` de nginx no sustituye la
verificación de API Gateway: el health check del BFF se valida contra el URL
`execute-api`.

### Commit

```text
feat(gateway): add repeatable API Gateway and static hosting
```

### Evidencias recomendadas para el informe

Conservar una carpeta fuera de Git, por ejemplo `evidencias/ep2/fase-1/`,
organizada por fecha. No guardar tokens, contraseñas, cookies ni archivos `.env`.
Para cada evidencia registrar fecha, región AWS, comando ejecutado y resultado.

1. `01-sts-caller-identity.txt`: salida de
   `aws sts get-caller-identity`, ocultando cualquier dato que el profesor no
   requiera.
2. `02-cloudformation-stack.png`: consola CloudFormation mostrando el stack
   `srmm-frontend` en estado `CREATE_COMPLETE`.
3. `03-s3-public-access-block.png`: bloqueo de acceso público y ausencia de
   objetos públicos en el bucket.
4. `04-cloudfront-distribution.png`: distribución habilitada, HTTPS, OAC,
   dominio `cloudfront.net` y respuestas personalizadas 403/404.
5. `05-api-gateway-routes.png`: rutas `/health` y `/api/{proxy+}`, integración
   HTTP, stage y JWT authorizer.
6. `06-api-gateway-authorizer.png`: issuer, audience y scope configurados. Se
   deben ocultar tokens; nunca capturar un JWT completo.
7. `07-curl-health.txt`: `curl.exe -i` al `/health` público con código 200.
8. `08-curl-unauthorized.txt`: `curl.exe -i` a `/api/me` sin token con código
   401 (o 503 si el BFF aún está deshabilitado localmente).
9. `09-cloudfront-spa.txt`: navegación directa a una ruta React y código 200.
10. `10-entra-redirect-uris.png`: pantalla de Entra con localhost y CloudFront
    como redirect URIs SPA, ocultando identificadores que no sean necesarios.

Una evidencia fuerte combina captura de consola y archivo de texto reproducible.
Usar nombres secuenciales, conservar el commit desplegado en
`11-commit.txt` (`git rev-parse HEAD`) y anotar en el informe qué requisito
demuestra cada archivo.

### Paso a paso en AWS Academy

1. Iniciar el Learner Lab, abrir AWS Console y seleccionar la región definida
   en `AWS_REGION`. La región debe ser la misma para S3, CloudFront y API
   Gateway; CloudFront es global, pero sus recursos de origen se crean en la
   región seleccionada.
2. En **CloudShell** ejecutar `aws sts get-caller-identity` y guardar la
   salida. Si se usa una terminal local, configurar las credenciales temporales
   del laboratorio sin escribirlas en el repositorio.
3. Crear `infra/.env` a partir de `infra/.env.example` solo localmente.
   Completar bucket globalmente único, hostname DuckDNS, región, origen BFF,
   issuer y audience reales. El script rechaza placeholders.
4. Validar la plantilla sin crear recursos:

   ```powershell
   aws cloudformation validate-template `
     --template-body file://infra/cloudformation-static-site.yaml `
     --region <AWS_REGION>
   ```

5. Desplegar el stack CloudFormation desde la raíz con el comando de
   `infra/README.md`. Esperar `CREATE_COMPLETE` y guardar outputs.
6. Subir una primera versión del frontend con `infra/deploy-frontend.ps1`.
   Antes, copiar `frontend/.env.example` a `frontend/.env` y configurar la URL
   real del API Gateway y el scope real de Entra.
7. En **Microsoft Entra > App registrations > aplicación SPA**, agregar
   `https://<CLOUDFRONT_DOMAIN>` como Redirect URI y conservar
   `http://localhost:5173`. Verificar también post logout redirect URI.
8. En API Gateway ejecutar `infra/deploy-http-api.ps1`. Revisar en consola que
   el authorizer JWT use exactamente los claims `iss` y `aud` del access token
   real, y que el scope requerido sea `access_as_user`.
9. En **EC2 > Security Groups**, mantener SSH restringido y abrir 3001 solo a
   la fuente necesaria para el diseño elegido. No abrir 5672 ni 15672.
10. Probar primero `GET /health`, después `/api/me` sin token y finalmente el
    login desde CloudFront. Solo después de confirmar esas pruebas retirar nginx
    y Certbot de la EC2.

En AWS Academy pueden faltar permisos para CloudFront, OAC o API Gateway. Si
ocurre un `AccessDenied`, guardar el mensaje como evidencia, no intentar crear
roles IAM nuevos y solicitar al profesor una cuenta con permisos o una
alternativa autorizada. `LabRole` es el rol disponible para servicios que lo
requieran.

## Fase 2: RabbitMQ local y primer flujo con DLQ

### Objetivo

Agregar RabbitMQ con `rabbitmq:3-management` al Compose. Para desarrollo local,
los puertos `5672` y `15672` se publican únicamente en `127.0.0.1`; en EC2 no
se publican y se accede a la consola mediante túnel SSH. Completar el flujo de
arriendo creado hacia una notificacion.

### Archivos

- Modificar `docker-compose.yml` y los `.env.example` del backend.
- Crear un modulo central de configuracion RabbitMQ.
- Crear conexion/publicador con confirm channel y mensajes persistentes.
- Integrar la publicacion en el caso de arriendo sin hacer fallar la API si el
  broker esta caido.
- Crear consumidor de notificaciones con prefetch, ACK manual, reintentos y
  DLQ, incluyendo consumidor de la DLQ.
- Agregar tests unitarios con mocks.

### Comandos y verificacion

```powershell
docker compose up -d postgres rabbitmq
docker compose ps
cd backend
npm test
```

Si Docker Desktop no está iniciado, primero abrirlo y esperar que
`docker info` responda. Un error
`dockerDesktopLinuxEngine ... The system cannot find the file specified`
significa que el daemon local no está disponible todavía; no es evidencia de
que RabbitMQ haya fallado.

Crear un arriendo con RabbitMQ detenido debe conservar la respuesta normal del
BFF y registrar el error. Con RabbitMQ activo, el consumidor debe ACKear un
mensaje valido, reintentar errores recuperables hasta el maximo y enviar los
errores definitivos a la DLQ. Cada mensaje muerto debe registrar ID, cola y
motivo.

### Evidencias recomendadas

- `fase-2/01-compose-ps.txt`: `docker compose ps` con PostgreSQL y RabbitMQ
  saludables.
- `fase-2/02-rabbit-ports.txt`: evidencia de que el Compose local solo publica
  `127.0.0.1:5672` y `127.0.0.1:15672`, nunca una interfaz pública.
- `fase-2/03-config-test.txt`: tests de nombres centralizados y reintentos.
- `fase-2/04-rental-event.txt`: logs del BFF con publicación confirmada y
  respuesta HTTP normal del arriendo.
- `fase-2/05-consumer-ack.txt`: log del consumidor procesando y ACKeando el
  evento.
- `fase-2/06-consumer-dlq.txt`: log de reintentos y envío a DLQ con event ID,
  cola y motivo.

En capturas de RabbitMQ Management ocultar credenciales y no exponer la
consola a Internet; usar túnel SSH si se necesita mostrarla.

### Commit

```text
feat(rabbit): publish rental notifications with dead letter handling
```

## Fase 3: logística, incidencias y consumidores

### Objetivo

Añadir notificaciones por cambio de estado logístico e incidencia crítica de
mantenimiento. La exportación CSV queda opcional y solo se implementa si el
tiempo de la entrega lo permite. Esta fase ya está implementada en la rama:
`crear` y `actualizar` de logística publican `logistica.estado-cambiado`; el
endpoint `POST /api/mantenimientos/incidencias` registra incidencias y publica
solo las de criticidad `Alta`.

### Archivos

- Extender el modulo central de nombres y declaraciones.
- Integrar productores en los servicios de logística y mantenimientos.
- Consumir los tres tipos de evento con ACK manual, reintentos por
  `x-retry-count` y DLQ independiente por topología.
- Mantener la respuesta síncrona aunque RabbitMQ esté apagado.

### Verificacion

Ejecutar `npm test` y `npm test --prefix services/notificaciones`, publicar cada evento con el broker activo y comprobar ACK,
reintento y DLQ por flujo. Con el broker apagado, las respuestas síncronas de
los dominios deben continuar sin cambios.

### Commit

```text
feat(rabbit): add logistics and maintenance event consumers
```

## Fase 4: microservicio rabbit-admin

### Objetivo

Crear `services/rabbit-admin` como API REST separada, protegida por el mismo
JWT del BFF y restringida al rol `Administrador`.

### Archivos

- Crear `services/rabbit-admin/` con configuración, DTO/validación, servicio,
  controladores y rutas.
- Crear `RabbitAdminService` como única capa que conoce `amqplib`.
- Exponer POST/GET/DELETE de queues, POST/DELETE de exchanges y
  POST/DELETE de bindings.
- Compartir el middleware de autenticación mediante un pequeño módulo común,
  evitando duplicar reglas de issuer, audience y JWKS.

### Verificacion

Validar nombres no vacíos, caracteres inválidos, tipos de exchange no
permitidos y configuraciones inconsistentes con respuestas `400`. Sin token:
`401`; con token sin `Administrador`: `403`; con rol correcto: ejecutar la
operación mockeada y obtener `2xx`.

### Commit

```text
feat(rabbit-admin): add protected RabbitMQ management API
```

## Fase 5: despliegue en EC2

### Objetivo

Ejecutar BFF, notificaciones y rabbit-admin mediante PM2, y RabbitMQ mediante
Compose en la EC2 existente.

### Archivos

- Crear `ecosystem.config.cjs` con los tres procesos.
- Crear script de actualización DuckDNS que lea el token solo desde una
  variable de entorno y pueda ejecutarse con cron o systemd.
- Documentar instalación de Docker/Compose en Amazon Linux 2023, despliegue,
  variables y rollback.

### Comandos y seguridad

```powershell
docker compose up -d postgres rabbitmq
pm2 start ecosystem.config.cjs
pm2 save
sudo systemctl disable --now nginx
sudo systemctl disable --now certbot-renew.timer
```

El Security Group permite solo SSH con origen restringido, puerto 3001 según
la topología elegida y el puerto del gateway si fuera estrictamente necesario.
No abrir `5672` ni `15672`. La consola RabbitMQ se usa mediante túnel SSH.
No crear roles IAM nuevos en Academy: usar `LabRole` cuando el servicio lo
requiera.

### Verificacion

Comprobar `pm2 status`, `curl http://localhost:3001/health`, el health check
del Compose y el acceso externo únicamente por API Gateway. Verificar que
RabbitMQ no responde desde Internet en 5672/15672.

### Commit

```text
chore(deploy): document EC2 PM2 and DuckDNS deployment
```

## Fase 6: pruebas, verificacion y entrega

### Objetivo

Cerrar la entrega con pruebas repetibles, revisión de secretos y evidencia de
los flujos síncronos y asíncronos.

### Comandos

```powershell
git status --short
npm test
cd frontend
npm run build
cd ..
docker compose config
git diff --check
git log --oneline --decorate -10
```

### Lista de evidencia

- API Gateway: health público, ruta protegida `401` sin token y `200` con token
  válido.
- CloudFront: carga HTTPS, login MSAL y refresh de ruta React.
- RabbitMQ: flujo de arriendo, ACK, reintento y DLQ.
- Rabbit-admin: validación, JWT y rol Administrador.
- EC2: PM2, Compose, DuckDNS y puertos no publicados.
- `git status` sin `.env`, claves, tokens ni logs.

### Commit

```text
test(ep2): verify gateway messaging and deployment
```

## Entrega y merge

Subir cada commit de fase después de la revisión correspondiente:

```powershell
git push -u origin ep2-rabbitmq-gateway
git push origin ep2-rabbitmq-gateway
```

Al finalizar y aprobar la rama:

```powershell
git switch main
git pull --ff-only
git merge --no-ff ep2-rabbitmq-gateway -m "merge: deliver EP2 gateway and RabbitMQ"
git push origin main
```

Si el remoto requiere revisión, abrir un Pull Request desde
`ep2-rabbitmq-gateway` hacia `main` en lugar de hacer el merge local.
