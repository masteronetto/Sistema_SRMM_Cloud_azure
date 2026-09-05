# SRMM BFF

BFF independiente para el frontend React. Arranca sin tenant configurado y devuelve `503` en rutas protegidas hasta definir Azure AD.

## Inicio

```bash
npm install
npm run dev
```

Copiar `.env.example` a `.env` cuando se disponga de la configuracion del tenant.
