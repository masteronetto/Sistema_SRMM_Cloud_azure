# Evidencia de integración RabbitMQ y Spring Boot

Este documento describe cómo demostrar el consumo de eventos, los ACK
explícitos, los errores, los reintentos transitorios y las DLQ para arriendos,
logística y mantenimientos. Las pruebas automatizadas usan un RabbitMQ
exclusivo en los puertos locales `5673` y `15673`; no alteran el broker de
producción.

## Arquitectura bajo prueba

El BFF Express publica eventos persistentes usando `amqplib`. Spring Boot
declara la topología y agrupa un `@RabbitListener` por dominio. Cada listener
delega el ACK/NACK al procesador común:

```java
@RabbitListener(
    queues = RabbitTopology.LOGISTICS_QUEUE,
    containerFactory = "rabbitListenerContainerFactory")
public void consume(Message message, Channel channel) throws IOException {
    messageProcessor.process(
        message,
        channel,
        RabbitTopology.LOGISTICS_QUEUE,
        RabbitTopology.LOGISTICS_EXCHANGE,
        RabbitTopology.LOGISTICS_ROUTING_KEY,
        () -> eventHandler.handleLogistics(message)
    );
}
```

Los listeners de arriendos y mantenimientos siguen el mismo patrón, usando
sus constantes de dominio. El productor logístico del BFF es:

```js
export async function publishLogisticsStateChanged(event) {
  return publishEvent(logisticsStateTopology(), 'logistica.estado-cambiado', event);
}
```

La decisión de confirmación se realiza explícitamente:

```java
try {
    handler.run();
    channel.basicAck(deliveryTag, false);
} catch (NonRecoverableNotificationException exception) {
    channel.basicNack(deliveryTag, false, false);
} catch (TransientNotificationException exception) {
    // Republica con contador acotado y confirma el mensaje original.
}
```

Un mensaje no recuperable —por ejemplo, JSON malformado, tipo inesperado o
identificador ausente— se rechaza sin reencolar y RabbitMQ lo enruta a la DLQ
del dominio. Solo `TransientNotificationException` activa reintentos: hasta
tres entregas en total. Al agotar el límite, también se envía a DLQ. Cada
rechazo registra identificador del evento, cola y motivo.

## Escenarios de integración

`NotificationsIntegrationTest` publica mensajes en el exchange real del
broker de pruebas y observa el consumo, las invocaciones y las colas DLQ:

| Dominio o escenario | Resultado esperado |
|---|---|
| Arriendos: evento válido | Un consumo y ACK |
| Arriendos: falta `id_contrato` | NACK sin reencolar; `srmm.notificaciones.arriendo-creado.dlq` |
| Logística: evento válido | Un consumo y ACK |
| Logística: falta `id_evento` | NACK sin reencolar; `srmm.notificaciones.logistica-estado.dlq` |
| Mantenimientos: evento válido | Un consumo y ACK |
| Mantenimientos: falta `id_incidencia` | NACK sin reencolar; `srmm.tickets.incidencia-critica.dlq` |
| Logística: error transitorio que se recupera | Un reintento y posterior ACK |
| Logística: error transitorio persistente | Tres entregas y luego DLQ |
| Logística: JSON malformado | DLQ inmediata, sin reintentos |

Las aserciones de DLQ verifican que RabbitMQ recibió el mensaje y añadió
`x-death` con motivo `rejected`.

Validación local realizada el 2 de noviembre de 2026: las trece pruebas
Spring (nueve integradas y cuatro unitarias) aprobaron; las diez pruebas de
`rabbit-admin`, incluida la conexión real a RabbitMQ, aprobaron; y las ocho
pruebas existentes del BFF también aprobaron.

## Ejecución local y capturas

Desde PowerShell, en la raíz del repositorio:

```powershell
$env:RABBITMQ_TEST_PASSWORD = [guid]::NewGuid().ToString("N")
docker compose -f services/notificaciones-spring/docker-compose.test.yml up -d --wait
docker compose -f services/notificaciones-spring/docker-compose.test.yml ps
```

Captura recomendada: el servicio `srmm-notificaciones-rabbitmq-test` debe
aparecer `healthy`. No muestres el valor de `RABBITMQ_TEST_PASSWORD`.

Ejecuta la suite Spring:

```powershell
Push-Location services/notificaciones-spring
.\mvnw.cmd test
Pop-Location
```

Captura recomendada: resumen de Maven con trece pruebas (nueve integradas y
cuatro unitarias), cero fallos, cero errores y `BUILD SUCCESS`. El informe
Surefire queda en `services/notificaciones-spring/target/surefire-reports`.

Prueba los casos de `rabbit-admin` contra el mismo broker aislado:

```powershell
$env:RABBITMQ_TEST_URL = "amqp://srmm_test:$($env:RABBITMQ_TEST_PASSWORD)@127.0.0.1:5673"
$env:RABBITMQ_TEST_MANAGEMENT_URL = "http://127.0.0.1:15673"
Push-Location services/rabbit-admin
npm test
Pop-Location
```

La prueba real de administración está condicionada a estas dos variables.
Comprueba `GET /queues/<nombre-inexistente>` seguido de `GET` de una cola
existente, la recuperación del canal y el listado de colas desde RabbitMQ
Management API.

Al finalizar, apaga únicamente el broker de pruebas:

```powershell
docker compose -f services/notificaciones-spring/docker-compose.test.yml down
Remove-Item Env:RABBITMQ_TEST_URL -ErrorAction SilentlyContinue
Remove-Item Env:RABBITMQ_TEST_MANAGEMENT_URL -ErrorAction SilentlyContinue
Remove-Item Env:RABBITMQ_TEST_PASSWORD -ErrorAction SilentlyContinue
```

## Evento logístico exitoso en la instancia

La prueba automatizada demuestra el flujo técnico con un broker aislado. Para
registrar además una evidencia visual desde la aplicación desplegada:

1. Conéctate a la instancia actual. La IPv4 puede cambiar; la indicada para
   esta sesión es `54.167.101.28`.

   ```powershell
   ssh -i "C:\Users\onett\Downloads\srmm.pem" ec2-user@54.167.101.28
   ```

2. En la aplicación, crea un evento logístico identificable como prueba,
   sin asociarlo a maquinaria ni contrato si el formulario lo permite.
3. Captura la confirmación del registro y anota su `id_evento`.
4. En SSH, confirma el procesamiento usando ese identificador:

   ```bash
   grep -F 'id_evento=<ID_EVENTO>' ~/.pm2/logs/srmm-notificaciones-spring-out-*.log | tail -n 5
   ```

5. Captura la línea `Evento de logistica procesado correctamente` junto con
   el `id_evento` correspondiente. No captures ni compartas contraseñas,
   tokens o valores de entorno.
6. Si se creó un registro exclusivamente para la prueba, elimínalo desde la
   aplicación después de guardar la evidencia.

La ejecución en EC2 del 29 de octubre de 2026 procesó correctamente el
evento de prueba `id_evento=5` con la versión anterior al ACK manual. Para
evidenciar la versión actualizada, repite estos pasos después de desplegar
los cambios descritos en este documento.
