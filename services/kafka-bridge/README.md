# Kafka Bridge

Servicio Spring Boot 3.4 / Java 17 que copia los eventos de `srmm.arriendos`, `srmm.logistica` y `srmm.mantenimientos` desde colas durable propias a Kafka. No consume las colas de notificaciones existentes. Los mensajes inválidos se rechazan a DLQ; los fallos de Kafka se reencolan.

Configura `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` y `KAFKA_BOOTSTRAP_SERVERS` junto con las variables opcionales de productor en `.env.example`.

Desde esta carpeta:

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

Los eventos se publican en `srmm.eventos-operacionales` con clave `dominio:id` (el identificador de negocio del evento). Los eventos logísticos con maquinaria asociada y las incidencias de mantenimiento también se publican en `srmm.estado-maquinaria`, usando el estado existente del evento/incidencia y la maquinaria indicada en el payload. Si logística no incluye `maquinaria_id_maquina`, solo se publica el evento operacional.
