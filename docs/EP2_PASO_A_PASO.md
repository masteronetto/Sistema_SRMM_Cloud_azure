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

## Fase 1: API Gateway, DuckDNS, nginx y Entra

### Objetivo

La arquitectura final separa las entradas: nginx sirve el frontend React por
HTTPS desde EC2 y API Gateway publica únicamente el BFF. DuckDNS proporciona
el nombre estable de la instancia. S3 y CloudFront quedan como componentes
preparados, pero no se utilizan en producción porque el rol de AWS Academy no
incluye los permisos necesarios para administrar CloudFront/OAC.

### Archivos

- Crear `infra/` con scripts AWS CLI o una plantilla reproducible, sin IDs ni
  dominios reales.
- Crear `infra/.env.example` con region, bucket, distribution, API, tenant,
  issuer, audience, scope, origen CloudFront y hostname DuckDNS.
- Actualizar `frontend/.env.example` y el cliente Vite para separar la URL de
  API Gateway del fallback local.
- Crear un script reproducible para API Gateway.
- Mantener nginx y Certbot activos en EC2 para servir el frontend.

### Comandos

```powershell
aws sts get-caller-identity
aws configure list
Copy-Item infra\.env.example infra\.env
cd frontend
npm run build
curl.exe -i https://<API_ID>.execute-api.<AWS_REGION>.amazonaws.com/health
```

Para HTTP API Gateway, configurar dos integraciones al BFF:

- `ANY /api/{proxy+}` hacia `http://<DUCKDNS_HOST>:3001`.
- `GET /health` hacia `http://<DUCKDNS_HOST>:3001/health`, sin autorizador.

El endpoint administrativo de RabbitMQ se añade en la Fase 4. CORS debe
permitir `https://<DUCKDNS_HOST>` y, durante desarrollo,
`http://localhost:5173`. El frontend productivo permanece en
`https://<DUCKDNS_HOST>` servido por nginx; API Gateway se utiliza para las
llamadas del BFF.

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

### Paso a paso en AWS Academy

1. Iniciar el Learner Lab, abrir AWS Console y seleccionar la región definida
   en `AWS_REGION`. Usar la misma región para RDS, EC2 y API Gateway.
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
6. Configurar `frontend/.env` con la URL real del API Gateway y el scope real
   de Entra. Construir el frontend y publicarlo en la ruta servida por nginx.
7. En **Microsoft Entra > App registrations > aplicación SPA**, agregar
   `https://<DUCKDNS_HOST>` como Redirect URI y conservar
   `http://localhost:5173`. Verificar también post logout redirect URI.
8. En API Gateway ejecutar `infra/deploy-http-api.ps1`. Revisar en consola que
   el authorizer JWT use exactamente los claims `iss` y `aud` del access token
   real, y que el scope requerido sea `access_as_user`.
9. En **EC2 > Security Groups**, mantener SSH restringido y abrir 3001 solo a
   la fuente necesaria para el diseño elegido. No abrir 5672 ni 15672.
10. Probar primero `GET /health` mediante API Gateway, después `/api/me` sin
    token y finalmente el login desde `https://<DUCKDNS_HOST>`. Mantener nginx
    y Certbot activos, porque continúan sirviendo el frontend.

En AWS Academy pueden faltar permisos para CloudFront, OAC o API Gateway. Si
ocurre un `AccessDenied`, no intentar crear roles IAM nuevos. `LabRole` es el
rol disponible para servicios que lo requieran.

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
significa que el daemon local no está disponible todavía; se debe iniciar
Docker antes de continuar.

Crear un arriendo con RabbitMQ detenido debe conservar la respuesta normal del
BFF y registrar el error. Con RabbitMQ activo, el consumidor debe ACKear un
mensaje valido, reintentar errores recuperables hasta el maximo y enviar los
errores definitivos a la DLQ. Cada mensaje muerto debe registrar ID, cola y
motivo.

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

La implementación local queda disponible en el puerto `3002`, publicado solo
en loopback por Compose. Sus operaciones son:

```text
POST   /queues
GET    /queues/:queue
DELETE /queues/:queue
POST   /exchanges
DELETE /exchanges/:exchange
POST   /bindings
DELETE /bindings
```

Todas requieren Bearer token válido, el scope configurado y el App Role
`Administrador`. Rabbit-admin no debe exponerse directamente a Internet:
cuando se publique en EC2, se accede mediante un túnel SSH o una ruta
administrativa explícitamente protegida.

### Verificacion

Validar nombres no vacíos, caracteres inválidos, tipos de exchange no
permitidos y configuraciones inconsistentes con respuestas `400`. Sin token:
`401`; con token sin `Administrador`: `403`; con rol correcto: ejecutar la
operación y obtener `2xx`. En AWS Academy configurar las variables
`AZURE_TENANT_ID`, `AZURE_API_AUDIENCE`, `AZURE_REQUIRED_SCOPE` y
`AZURE_AUTH_ENABLED=true` en el entorno del servicio; no incluirlas en Git.

### Commit

```text
feat(rabbit-admin): add protected RabbitMQ management API
```

## Fase 5: despliegue en EC2

### Objetivo

Ejecutar BFF, notificaciones y rabbit-admin mediante PM2, RabbitMQ mediante
Compose y el frontend React mediante nginx en la EC2 existente. API Gateway
publica el BFF sin reemplazar nginx.

### Archivos

- `ecosystem.config.cjs` administra los tres procesos con PM2: BFF,
  notificaciones y rabbit-admin. Cada proceso usa su propio `cwd`, por lo que
  `dotenv` lee el `.env` local del servicio.
- `scripts/update-duckdns.sh` actualiza DuckDNS usando el token únicamente
  desde `DUCKDNS_TOKEN`.
- Documentar instalación de Docker/Compose en Amazon Linux 2023, despliegue,
  variables y rollback.

### Comandos y seguridad

```bash
docker compose up -d rabbitmq
pm2 start ecosystem.config.cjs
pm2 save
sudo systemctl enable --now nginx
```

El Security Group permite solo SSH con origen restringido, puerto 3001 según
la topología elegida y el puerto del gateway si fuera estrictamente necesario.
No abrir `5672` ni `15672`. La consola RabbitMQ se usa mediante túnel SSH.
No crear roles IAM nuevos en Academy: usar `LabRole` cuando el servicio lo
requiera.

En EC2, desde la raíz del repositorio, ejecutar:

```bash
chmod +x scripts/update-duckdns.sh
export DUCKDNS_TOKEN='<token-no-se-versiona>'
export DUCKDNS_DOMAIN='srmm'
./scripts/update-duckdns.sh

cd services/rabbit-admin && npm ci --omit=dev && cd ../..
cd services/notificaciones && npm ci --omit=dev && cd ../..
cd backend && npm ci --omit=dev && cd ..
pm2 start ecosystem.config.cjs
pm2 save
```

No ejecutar `docker compose up -d` sin especificar el servicio en esta fase:
`rabbit-admin` se administra mediante PM2 para evitar ejecutar dos instancias
del mismo servicio en el puerto `3002`.

### Verificacion

Comprobar `pm2 status`, `curl http://localhost:3001/health`, el health check
del Compose, `https://<DUCKDNS_HOST>` y el acceso público del BFF únicamente
por API Gateway. Verificar que RabbitMQ no responde desde Internet en
5672/15672 y que nginx permanece activo.

### Commit

```text
chore(deploy): document EC2 PM2 and DuckDNS deployment
```

## Fase 6: pruebas, verificacion y entrega

### Objetivo

Cerrar la entrega con pruebas repetibles, revisión de secretos y validación de
los flujos síncronos y asíncronos.

### Comandos de validación

```powershell
npm test
npm test --prefix services/notificaciones
npm test --prefix services/rabbit-admin
docker compose config
git diff --check
git status --short
git log --oneline --decorate -10
```

En EC2:

```bash
pm2 status
sudo systemctl is-enabled pm2-ec2-user
sudo systemctl is-active pm2-ec2-user
sudo systemctl is-active nginx
sudo nginx -t
docker compose ps
curl -s http://127.0.0.1:3001/health
```

Desde el equipo local:

```powershell
curl.exe -i https://<API_ID>.execute-api.<AWS_REGION>.amazonaws.com/health
curl.exe -i https://<API_ID>.execute-api.<AWS_REGION>.amazonaws.com/api/me
curl.exe -I https://<DUCKDNS_HOST>
```

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

## Diagrama de arquitectura final

```text
                           Usuarios
                  ┌────────────┴────────────┐
                  │                         │
       Navegador / frontend             Llamadas API
                  │                         │
                  ▼                         ▼
       https://srmm.duckdns.org       API Gateway HTTP API
                  │                    agz783uwu6
                  ▼                         │
              nginx :443                    │
       sirve frontend React                │
                  │                         │
                  └──────────────┬──────────┘
                                 │
                                 ▼
                         BFF Express :3001
                       PM2 - srmm-bff
                          │         │
                          │         └──────────────► RDS PostgreSQL
                          │
                          └────────► RabbitMQ :5672
                                      Docker Compose
                                             │
                                             ▼
                              PM2 - srmm-notificaciones
                              ACK / reintentos / DLQ

                   PM2 - srmm-rabbit-admin :3002
                   acceso local o túnel SSH protegido
```

### Flujo de una solicitud y un evento

1. El usuario carga el frontend desde nginx mediante HTTPS y DuckDNS.
2. El frontend envía las llamadas del sistema a API Gateway.
3. API Gateway valida JWT y scope en las rutas protegidas.
4. API Gateway reenvía `/api/{proxy+}` al BFF en el puerto `3001`.
5. El BFF consulta o actualiza RDS y publica eventos en RabbitMQ.
6. El consumidor recibe el evento, ejecuta la notificación y confirma con
   ACK manual.
7. Los errores recuperables usan reintentos; los definitivos se envían a la
   DLQ correspondiente.
8. RabbitMQ y `rabbit-admin` no se exponen directamente a Internet.
