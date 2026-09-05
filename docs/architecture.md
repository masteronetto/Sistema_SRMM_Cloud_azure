# Arquitectura base del prototipo

## Estado actual

- El repositorio es una base aislada del proyecto original.
- La base de datos esta deshabilitada por defecto con `DATABASE_ENABLED=false`.
- No se versionan credenciales ni archivos `.env`.
- Las vistas y la logica de negocio existentes se conservan como referencia funcional.

## Arquitectura objetivo

```text
React + MSAL
      |
      | Access token Azure AD
      v
AWS API Gateway
      |
      v
BFF protegido con Spring Security
      |
      +--> Servicio de usuarios
      +--> Servicio de pedidos
      +--> Servicio de productos
      |
      v
Base de datos cloud
```

## Etapas de trabajo

1. Convertir `frontend/` en una aplicacion React compilable y organizar sus componentes.
2. Integrar Azure AD mediante `@azure/msal-browser` y `@azure/msal-react`.
3. Proteger las rutas del frontend y adjuntar el access token en las llamadas HTTP.
4. Implementar el BFF con validacion de issuer, audience, firma, expiracion, roles y scopes.
5. Extraer los dominios funcionales reutilizables hacia servicios Spring Boot.
6. Desplegar los servicios en EC2 y exponerlos mediante AWS API Gateway.
7. Activar una base de datos nueva y aislada solo cuando exista una configuracion explicita para este repositorio.

## Regla de aislamiento

No se debe copiar un `.env` del proyecto original. Para habilitar persistencia en este prototipo se debe usar una base de datos propia y declarar `DATABASE_ENABLED=true` junto con sus variables en el entorno local o en el proveedor de despliegue.