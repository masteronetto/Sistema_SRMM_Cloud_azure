# Infraestructura de EP2

Esta carpeta contiene artefactos reproducibles para publicar el BFF mediante
API Gateway. nginx continúa sirviendo el frontend React por HTTPS desde EC2.

## Requisitos

- AWS CLI autenticado en la cuenta/región de trabajo.
- Permisos para S3, CloudFront y API Gateway HTTP API. AWS Academy puede
  restringir algunos recursos; en ese caso conservar el BFF en EC2 y ejecutar
  solo los componentes permitidos.
- Un origen BFF accesible por HTTP desde API Gateway:
  `http://<DUCKDNS_HOST>:3001`.
- Valores reales de issuer y audience obtenidos desde un access token emitido
  para la API. No usar el client ID del frontend como audience por suposición.

## Frontend y CloudFront opcional

La plantilla `cloudformation-static-site.yaml` crea:

- Bucket S3 privado sin website hosting.
- Origin Access Control (OAC).
- Distribución CloudFront con el bucket como origen.
- Respuestas 403 y 404 que sirven `/index.html` con estado 200, necesarias
  para las rutas de React.
- Política del bucket que permite lectura únicamente a esa distribución.

Desplegarla con:

```powershell
aws cloudformation deploy `
  --template-file infra/cloudformation-static-site.yaml `
  --stack-name srmm-frontend `
  --parameter-overrides BucketName=<PRIVATE_S3_BUCKET_NAME> `
  --region <AWS_REGION>
```

En la arquitectura final el frontend se sirve mediante nginx en EC2 y
CloudFront queda como componente preparado, pero no utilizado, debido a las
restricciones del rol AWS Academy. La URL de producción y el redirect URI SPA
son `https://<DUCKDNS_HOST>`. Mantener `http://localhost:5173` para desarrollo.

## HTTP API Gateway

`deploy-http-api.ps1` crea o actualiza:

- `ANY /api/{proxy+}` hacia `<API_ORIGIN_URL>/api/{proxy}`.
- `GET /health` sin autorización.
- JWT authorizer de Microsoft Entra para la ruta protegida, validando issuer,
  audience y scope `access_as_user`.
- CORS para CloudFront y localhost.

El script usa variables de entorno y falla si falta una variable requerida.
Esto evita que placeholders lleguen a AWS:

```powershell
$env:AWS_REGION = "<AWS_REGION>"
$env:API_NAME = "srmm-http-api"
$env:API_ORIGIN_URL = "http://<DUCKDNS_HOST>:3001"
$env:CLOUDFRONT_DOMAIN = "<CLOUDFRONT_DOMAIN>"
$env:AZURE_JWT_ISSUER = "<TOKEN_ISSUER_ISS>"
$env:AZURE_JWT_AUDIENCE = "<TOKEN_AUDIENCE_AUD>"
$env:AZURE_REQUIRED_SCOPE = "access_as_user"
.\infra\deploy-http-api.ps1
```

El issuer y audience exactos se obtienen decodificando un access token real
con una herramienta local de inspección, como jwt.ms, o consultando el campo
`audience` de `GET /api/me`. Los tokens v1 suelen usar
`https://sts.windows.net/<TENANT_ID>/` y los v2
`https://login.microsoftonline.com/<TENANT_ID>/v2.0`; se debe usar el issuer
de la versión realmente emitida por la aplicación.

## Publicación del frontend

Después de crear la distribución y configurar `frontend/.env` con la URL del
API Gateway:

```powershell
.\infra\deploy-frontend.ps1
```

El script ejecuta `npm run build`, sincroniza `frontend/dist` al bucket privado
y solicita una invalidación `/*`.

## nginx y seguridad de red

Mantener nginx y Certbot activos en EC2 para servir el frontend por HTTPS.
API Gateway publica el BFF, mientras el puerto 3001 debe limitarse al origen
necesario según la topología elegida. No exponer RabbitMQ en 5672/15672 ni
`rabbit-admin` en 3002 directamente a Internet.

## Consumidor de notificaciones Spring Boot

El consumidor de eventos se implementa en
`services/notificaciones-spring` con Java 17 y Spring AMQP. Antes de
iniciarlo, configurar `RABBITMQ_USER` y `RABBITMQ_PASSWORD` desde el
mecanismo seguro de secretos del servidor y comprobar que RabbitMQ está
disponible.

Empaquetar el microservicio desde la raíz del repositorio:

```bash
cd services/notificaciones-spring
sh ./mvnw -DskipTests package
cd ../..
```

Iniciar el proceso administrado por PM2:

```bash
pm2 start ecosystem.config.cjs --only srmm-notificaciones-spring
pm2 logs srmm-notificaciones-spring
```

La configuración Spring declara una cola y una DLQ por cada dominio. Los
consumidores usan ACK manual: los errores no recuperables se rechazan
directamente hacia DLQ, mientras que los errores tipados como transitorios
se reintentan hasta tres entregas. No se debe iniciar en paralelo
`services/notificaciones/src/consumer.js`, ya que ambos consumidores
competirían por los mensajes de las mismas colas.

El microservicio `rabbit-admin` expone listados `GET /queues` y
`GET /exchanges`, y las operaciones de creación responden `201`. Para listar
recursos, RabbitMQ Management debe estar habilitado. La URL se deriva del
`RABBITMQ_URL` AMQP usando el puerto Management estándar; se puede definir
`RABBITMQ_MANAGEMENT_URL` si el broker usa otra dirección. Mantén ese endpoint
accesible solo desde la red privada o loopback.

Las pruebas integradas utilizan un RabbitMQ exclusivo en el puerto local
5673. Define una contraseña temporal en la terminal e inicia el broker desde
la raíz del repositorio:

```bash
export RABBITMQ_TEST_PASSWORD="<contraseña-local-de-pruebas>"
docker compose -f services/notificaciones-spring/docker-compose.test.yml up -d --wait
```

Ejecuta las pruebas desde `services/notificaciones-spring` y luego detén
solamente el broker aislado:

```bash
cd services/notificaciones-spring
sh ./mvnw test
cd ../..
docker compose -f services/notificaciones-spring/docker-compose.test.yml down
```
