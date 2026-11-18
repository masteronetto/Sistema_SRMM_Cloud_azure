# Kafka local

El clúster usa una red propia (`srmm-kafka`) y no modifica `docker-compose.yml`.
Los puertos publicados están limitados a `127.0.0.1`: Kafka en `9092`, `9093` y `9094`, y Kafka UI en `8085`.

## Levantar

Desde la raíz del repositorio, copia `.env.example` a `.env` si todavía no tienes un `.env` local. Los valores Kafka de ejemplo son locales y no contienen secretos.

Si ya intentaste levantar el clúster antes de esta corrección, elimina los contenedores fallidos del proyecto anterior (conserva los volúmenes):

```powershell
docker compose -p sistema_srmm -f docker-compose.kafka.yml down
```

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.kafka.yml up -d
docker compose -f docker-compose.kafka-ui.yml up -d
```

Kafka UI estará disponible en <http://localhost:8085>.

## Verificar

```powershell
docker compose -f docker-compose.kafka.yml ps
docker compose -f docker-compose.kafka-ui.yml ps
docker compose -f docker-compose.kafka.yml exec kafka1 kafka-topics --bootstrap-server kafka1:29092 --list
```

Los cuatro servicios del clúster deben aparecer como `healthy`. El último comando lista los topics existentes; con `auto.create.topics.enable=false`, publicar en un topic inexistente no lo crea automáticamente.

## Topics iniciales

Los scripts crean de forma idempotente los topics operacionales, de estado y sus DLT, y aplican sus configuraciones:

```powershell
.\scripts\kafka\create-topics.ps1
```

En Bash:

```bash
bash scripts/kafka/create-topics.sh
```

Las configuraciones se vuelven a aplicar en cada ejecución. El script puede aumentar particiones faltantes; falla explícitamente si un topic existente tiene más particiones o un factor de réplica distinto, ya que Kafka no permite reducir particiones ni cambiar el factor directamente.

## Kafka Admin API

`services/kafka-admin` requiere Java 17 y Maven Wrapper. Configura `KAFKA_BOOTSTRAP_SERVERS`, `AZURE_TENANT_ID` y `AZURE_API_AUDIENCE`; habilita `AZURE_AUTH_ENABLED=true` solo cuando esos valores estén configurados. Toda operación requiere el scope configurado (por defecto `access_as_user`) y el rol `Administrador`. Con autenticación deshabilitada, la API responde `503`.

Desde PowerShell, ejecuta las pruebas y levanta el servicio:

```powershell
Set-Location services/kafka-admin
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

El endpoint `POST /consumer-groups/{id}/reset-offsets` admite `modo: "EARLIEST"`, `"LATEST"` o `"ESPECIFICO"`. EARLIEST/LATEST usan las particiones con offsets confirmados del grupo o, si no hay, el campo `topics` para resolver todas las particiones. ESPECIFICO usa la lista `offsets`; si se omite `modo` pero se envían `offsets`, se asume ESPECIFICO. Por ejemplo: `{"modo":"ESPECIFICO","offsets":[{"topic":"srmm.eventos-operacionales","partition":0,"offset":42}]}`. El grupo debe estar inactivo para cualquier modo.

## Kafka Bridge

`services/kafka-bridge` copia eventos desde colas RabbitMQ propias hacia Kafka. Configura `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` y `KAFKA_BOOTSTRAP_SERVERS` en el entorno. En el host, usa brokers `localhost:9092,localhost:9093,localhost:9094`; dentro de la red Docker `srmm-kafka`, usa `kafka1:29092,kafka2:29092,kafka3:29092`.

El bridge crea colas y DLQ propias, así que no compite con los consumidores de notificaciones. Los eventos válidos se publican en `srmm.eventos-operacionales`; logística con `maquinaria_id_maquina` y mantenimientos también se publican en `srmm.estado-maquinaria`. Ejecuta el servicio desde `services/kafka-bridge` con `.\mvnw.cmd test` y `.\mvnw.cmd spring-boot:run`.

## Kafka Analítica

`services/kafka-analitica` consume ambos topics en el grupo `analitica-group` con concurrencia 3. Un segundo consumidor, `auditoria-group`, lee `srmm.eventos-operacionales` independientemente para recibir su propia copia. El resumen por ventana y los últimos estados se mantienen solo en memoria y están disponibles en `GET /analitica/resumen`.

Configura `KAFKA_ANALITICA_GROUP_ID`, `KAFKA_AUDITORIA_GROUP_ID`, `KAFKA_DLT_GROUP_ID`, `KAFKA_ANALITICA_CONCURRENCY`, `KAFKA_AUTO_OFFSET_RESET`, `KAFKA_MAX_POLL_RECORDS`, `KAFKA_SESSION_TIMEOUT_MS`, `KAFKA_TRUSTED_PACKAGES` y `ANALITICA_WINDOW_DURATION` en el entorno. JSON inválido y DTO inválidos van directamente a `<topic>.DLT`; los errores transitorios tienen tres reintentos exponenciales de 1, 2 y 4 segundos. El consumidor DLT registra y confirma cada mensaje. Para levantarlo, desde `services/kafka-analitica` ejecuta `.\mvnw.cmd test` y `.\mvnw.cmd spring-boot:run`.

## Bajar

```powershell
docker compose -f docker-compose.kafka-ui.yml down
docker compose -f docker-compose.kafka.yml down
```

Los volúmenes nombrados se conservan para mantener los datos. Para eliminar también los datos persistidos, ejecuta `docker compose -f docker-compose.kafka.yml down -v`.

## Despliegue en EC2 (Amazon Linux 2023)

Kafka se ejecuta en Docker Compose y los tres servicios Spring (`kafka-admin`, `kafka-bridge` y `kafka-analitica`) se ejecutan como procesos Java administrados por PM2. Instala Java 17, Docker Compose, Node.js y PM2 en la instancia. Desde la raíz del repositorio, empaqueta los JAR:

```bash
for service in kafka-admin kafka-bridge kafka-analitica; do
  (cd "services/$service" && ./mvnw -DskipTests clean package)
done
```

En una instancia con RAM limitada, usa dos brokers y factor de réplica 2. Exporta estas variables antes de ejecutar Compose y el script de topics:

```bash
export KAFKA_REPLICATION_FACTOR=2
export KAFKA_MIN_INSYNC_REPLICAS=2
export KAFKA_BOOTSTRAP_SERVERS=localhost:9092,localhost:9093
docker compose -f docker-compose.kafka.yml up -d zookeeper1 zookeeper2 zookeeper3 kafka1 kafka2
bash scripts/kafka/create-topics.sh
```

El script mantiene RF 3 por defecto; `KAFKA_REPLICATION_FACTOR=2` configura RF 2 para los topics iniciales en este perfil. El archivo Compose publica los listeners Kafka solo en `127.0.0.1:9092` y `127.0.0.1:9093`; no abras esos puertos en el Security Group, firewall ni interfaz pública de EC2. Kafka UI, si se ejecuta, también debe permanecer enlazada a loopback. El BFF y los procesos Spring en la misma instancia usan `KAFKA_BOOTSTRAP_SERVERS=localhost:9092,localhost:9093`.

En un clúster ya desplegado con tres brokers, no detengas `kafka3` hasta verificar/reasignar las réplicas de los topics existentes. Con RF 2 y `min.insync.replicas=2`, una caída de cualquiera de los dos brokers detiene las escrituras hasta que vuelva a estar disponible.

Define las variables de aplicación en el entorno de despliegue seguro antes de iniciar PM2; no escribas credenciales en este documento, en el ecosystem file ni en Git. Proporciona `KAFKA_BOOTSTRAP_SERVERS`, `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME` y `RABBITMQ_PASSWORD` según el entorno; inyecta la contraseña de RabbitMQ desde AWS Systems Manager Parameter Store, Secrets Manager u otro mecanismo seguro. Para Kafka Admin configura `AZURE_TENANT_ID` y `AZURE_API_AUDIENCE`, y habilita `AZURE_AUTH_ENABLED=true` solo si ambos están definidos. Los puertos de servicio por defecto son `3003` para Kafka Admin y `3004` para Analítica.

Desde la raíz del repositorio, inicia los servicios:

```bash
pm2 start ecosystem.config.cjs --only srmm-kafka-admin,srmm-kafka-bridge,srmm-kafka-analitica
pm2 status
pm2 logs
pm2 save
```

Para comprobar Kafka sin exponer listeners:

```bash
docker compose -f docker-compose.kafka.yml ps
docker compose -f docker-compose.kafka.yml exec kafka1 kafka-topics --bootstrap-server kafka1:29092 --list
```

### Rollback

Conserva el artefacto JAR de la versión anterior antes de reemplazarlo. Para volver atrás, restaura los tres JARs previos en sus respectivas carpetas `services/<servicio>/target/` y reinicia únicamente los procesos Kafka:

```bash
pm2 restart srmm-kafka-admin --update-env
pm2 restart srmm-kafka-bridge --update-env
pm2 restart srmm-kafka-analitica --update-env
pm2 status
```

Si el release anterior está disponible en Git, también puedes volver al commit de aplicación anterior y reconstruir los JARs con Maven Wrapper antes del reinicio. No borres los volúmenes Docker durante el rollback: `docker compose down -v` elimina permanentemente los datos de Kafka. Mantén las variables del release anterior en el entorno seguro y usa `--update-env` para que PM2 las vuelva a cargar.
