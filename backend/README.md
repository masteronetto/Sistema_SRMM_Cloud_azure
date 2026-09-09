# SRMM BFF

BFF independiente para el frontend React. Arranca sin tenant configurado y devuelve `503` en rutas protegidas hasta definir Azure AD.

## Inicio

```bash
npm install
npm run dev
```

Copiar `.env.example` a `.env` cuando se disponga de la configuracion del tenant.

## Persistencia local

El BFF usa la base `srmm_cloud` cuando `DATABASE_ENABLED=true`. La migracion inicial esta en `sql/010_cloud_native_base.sql` y se monta desde el `docker-compose.yml` de la raiz.

```bash
docker compose up -d postgres
npm test
```

El endpoint de maquinaria requiere un access token Azure valido y el App Role `Administrador` para `POST` y `PUT`.
