# Kafka Admin API

API REST Spring Boot 3.4 / Java 17 para administrar topics y consumer groups de Kafka. Requiere un token Entra ID con issuer del tenant configurado, audience correcta, scope `access_as_user` y rol `Administrador`.

Configura `KAFKA_BOOTSTRAP_SERVERS`, `AZURE_TENANT_ID`, `AZURE_API_AUDIENCE`, `AZURE_REQUIRED_SCOPE` y `AZURE_AUTH_ENABLED` en el entorno. Con `AZURE_AUTH_ENABLED=false`, la API responde `503` y no habilita operaciones sin autenticación.

Desde esta carpeta:

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

Los endpoints de offsets aceptan destinos explícitos (`offsets: [{ "topic": "topic", "partition": 0, "offset": 42 }]`) y requieren que el consumer group esté inactivo.
