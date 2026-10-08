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

Reemplazar nginx como entrada publica por HTTP API Gateway, publicar el build
del frontend en un bucket S3 privado servido mediante CloudFront con OAC y
mantener la EC2 como origen del BFF.

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
El endpoint administrativo de RabbitMQ se añade en la Fase 4. CORS debe
permitir solo `https://<CLOUDFRONT_DOMAIN>` y, durante desarrollo,
`http://localhost:5173`.

### Obtener issuer y audience reales

No copiar valores de ejemplos. Iniciar sesión con la aplicación real y
decodificar un access token en `jwt.ms` solo para inspección local, o consultar
el campo `audience` que ya devuelve `GET /api/me`. El claim `iss` y el `aud`
de ese token son los valores del JWT authorizer. Los tokens v1 usan normalmente
`https://sts.windows.net/<TENANT_ID>/` y los v2
`https://login.microsoftonline.com/<TENANT_ID>/v2.0`; se debe aceptar la
versión emitida por la app `SRMM BFF API` según su manifiesto, sin adivinar.
Exigir `access_as_user` en `scope`.

En Entra agregar la URL HTTPS de CloudFront como Redirect URI de tipo SPA y
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
La navegación directa a una ruta React debe funcionar mediante respuestas de
error 403 y 404 de CloudFront que devuelvan `/index.html` con código `200`.

### Commit

```text
feat(gateway): add repeatable API Gateway and static hosting
```

## Fase 2: RabbitMQ local y primer flujo con DLQ

### Objetivo

Agregar RabbitMQ con `rabbitmq:3-management` al Compose sin publicar los
puertos `5672` ni `15672`, y completar el flujo de arriendo creado hacia una
notificacion.

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

Crear un arriendo con RabbitMQ detenido debe conservar la respuesta normal del
BFF y registrar el error. Con RabbitMQ activo, el consumidor debe ACKear un
mensaje valido, reintentar errores recuperables hasta el maximo y enviar los
errores definitivos a la DLQ. Cada mensaje muerto debe registrar ID, cola y
motivo.

### Commit

```text
feat(rabbit): publish rental notifications with dead letter handling
```

## Fase 3: resto de flujos y consumidores

### Objetivo

Añadir notificaciones por cambio de estado logístico e incidencia crítica de
mantenimiento. La exportación CSV queda opcional y solo se implementa si el
tiempo de la entrega lo permite.

### Archivos

- Extender el modulo central de nombres y declaraciones.
- Integrar productores en los servicios de logística y mantenimientos.
- Crear consumidores agrupados por dominio funcional y sus tests.

### Verificacion

Ejecutar `npm test`, publicar cada evento con el broker activo y comprobar ACK,
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
