# Infraestructura de EP2

Esta carpeta contiene artefactos reproducibles para sustituir nginx como
entrada pública y publicar el frontend React de forma segura.

## Requisitos

- AWS CLI autenticado en la cuenta/región de trabajo.
- Permisos para S3, CloudFront y API Gateway HTTP API. AWS Academy puede
  restringir algunos recursos; en ese caso conservar el BFF en EC2 y ejecutar
  solo los componentes permitidos.
- Un origen BFF accesible por HTTP desde API Gateway:
  `http://<DUCKDNS_HOST>:3001`.
- Valores reales de issuer y audience obtenidos desde un access token emitido
  para la API. No usar el client ID del frontend como audience por suposición.

## Frontend privado detrás de CloudFront

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

Registrar el output `CloudFrontDomainName` como `CLOUDFRONT_DOMAIN` y como
redirect URI SPA en Microsoft Entra. Mantener `http://localhost:5173` para
desarrollo.

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

## Retiro de nginx

Cuando CloudFront y API Gateway estén verificados, deshabilitar nginx y
Certbot en la EC2. No hacerlo antes de comprobar el endpoint `/health` público.
El puerto 3001 debe limitarse al origen necesario según la topología elegida.
