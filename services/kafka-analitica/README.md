# Kafka Analítica

Servicio Spring Boot 3.4 / Java 17 con dos grupos independientes: `analitica-group` consume los topics operacional y de maquinaria con concurrencia 3; `auditoria-group` consume el topic operacional y demuestra fan-out.

Los DTO conservan los mismos nombres, paquete y campos de Kafka Bridge (`cl.srmm.kafka.bridge.messaging.dto`) para deserializar sus type headers; en analítica incorporan restricciones Bean Validation. La analítica mantiene en memoria contadores por dominio para una ventana móvil configurable y el estado más reciente por maquinaria.

Configura las variables Kafka en `.env.example`. `KAFKA_BOOTSTRAP_SERVERS` debe apuntar a `localhost:9092,localhost:9093,localhost:9094` al ejecutar desde el host o a los listeners internos desde la red Docker `srmm-kafka`.

Desde esta carpeta:

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

Consulta el resumen en <http://localhost:8080/analitica/resumen>. Los datos son locales al proceso y se pierden al reiniciarlo.

Los payloads usan Bean Validation; JSON inválido y DTO inválidos se envían directamente a `<topic>.DLT`. Los demás errores tienen tres reintentos exponenciales (1 s, 2 s y 4 s). El consumidor DLT solo registra y confirma los mensajes muertos; deja configurados los topics DLT de ambos topics de entrada.
