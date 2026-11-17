module.exports = {
  apps: [
    {
      name: 'srmm-bff',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'srmm-notificaciones-spring',
      cwd: './services/notificaciones-spring',
      script: 'java',
      args: '-Xms64m -Xmx256m -jar target/notificaciones-spring-0.1.0.jar',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        SPRING_RABBITMQ_HOST: process.env.SPRING_RABBITMQ_HOST || '127.0.0.1',
        SPRING_RABBITMQ_PORT: process.env.SPRING_RABBITMQ_PORT || '5672',
        SPRING_RABBITMQ_USERNAME: process.env.RABBITMQ_USER || 'srmm',
        SPRING_RABBITMQ_PASSWORD: process.env.RABBITMQ_PASSWORD || ''
      }
    },
    {
      name: 'srmm-rabbit-admin',
      cwd: './services/rabbit-admin',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'srmm-kafka-admin',
      cwd: './services/kafka-admin',
      script: 'java',
      args: '-Xms64m -Xmx256m -jar target/kafka-admin-0.1.0.jar',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        SERVER_PORT: process.env.KAFKA_ADMIN_PORT || '3003',
        SERVER_ADDRESS: process.env.KAFKA_SERVER_ADDRESS || '127.0.0.1',  
        KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092,localhost:9093,localhost:9094',
        AZURE_TENANT_ID: process.env.AZURE_TENANT_ID || '',
        AZURE_API_AUDIENCE: process.env.AZURE_API_AUDIENCE || '',
        AZURE_REQUIRED_SCOPE: process.env.AZURE_REQUIRED_SCOPE || 'access_as_user',
        AZURE_AUTH_ENABLED: process.env.AZURE_AUTH_ENABLED || 'false'
      }
    },
    {
      name: 'srmm-kafka-bridge',
      cwd: './services/kafka-bridge',
      script: 'java',
      args: '-Xms64m -Xmx256m -jar target/kafka-bridge-0.1.0.jar',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
      env: {
        KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092,localhost:9093,localhost:9094',
        RABBITMQ_HOST: process.env.RABBITMQ_HOST || process.env.SPRING_RABBITMQ_HOST || '127.0.0.1',
        RABBITMQ_PORT: process.env.RABBITMQ_PORT || process.env.SPRING_RABBITMQ_PORT || '5672',
        RABBITMQ_USERNAME: process.env.RABBITMQ_USERNAME || process.env.RABBITMQ_USER || 'srmm',
        RABBITMQ_PASSWORD: process.env.RABBITMQ_PASSWORD || '',
        RABBITMQ_PREFETCH: process.env.RABBITMQ_PREFETCH || '10',
        KAFKA_PRODUCER_ACKS: process.env.KAFKA_PRODUCER_ACKS || 'all',
        KAFKA_PRODUCER_ENABLE_IDEMPOTENCE: process.env.KAFKA_PRODUCER_ENABLE_IDEMPOTENCE || 'true',
        KAFKA_PRODUCER_RETRIES: process.env.KAFKA_PRODUCER_RETRIES || '10',
        KAFKA_PRODUCER_LINGER_MS: process.env.KAFKA_PRODUCER_LINGER_MS || '5',
        KAFKA_PRODUCER_COMPRESSION_TYPE: process.env.KAFKA_PRODUCER_COMPRESSION_TYPE || 'lz4'
      }
    },
    {
      name: 'srmm-kafka-analitica',
      cwd: './services/kafka-analitica',
      script: 'java',
      args: '-Xms64m -Xmx256m -jar target/kafka-analitica-0.1.0.jar',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '384M',
       env: {
        SERVER_PORT: process.env.KAFKA_ANALITICA_PORT || '3004',
        SERVER_ADDRESS: process.env.KAFKA_SERVER_ADDRESS || '127.0.0.1',  
        KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092,localhost:9093,localhost:9094',
        KAFKA_TOPIC_OPERATIONAL_EVENTS: process.env.KAFKA_TOPIC_OPERATIONAL_EVENTS || 'srmm.eventos-operacionales',
        KAFKA_TOPIC_MACHINERY_STATE: process.env.KAFKA_TOPIC_MACHINERY_STATE || 'srmm.estado-maquinaria',
        KAFKA_TOPIC_OPERATIONAL_DLT: process.env.KAFKA_TOPIC_OPERATIONAL_DLT || 'srmm.eventos-operacionales.DLT',
        KAFKA_TOPIC_MACHINERY_STATE_DLT: process.env.KAFKA_TOPIC_MACHINERY_STATE_DLT || 'srmm.estado-maquinaria.DLT',
        KAFKA_ANALITICA_GROUP_ID: process.env.KAFKA_ANALITICA_GROUP_ID || 'analitica-group',
        KAFKA_AUDITORIA_GROUP_ID: process.env.KAFKA_AUDITORIA_GROUP_ID || 'auditoria-group',
        KAFKA_DLT_GROUP_ID: process.env.KAFKA_DLT_GROUP_ID || 'analitica-dlt-group',
        KAFKA_ANALITICA_CONCURRENCY: process.env.KAFKA_ANALITICA_CONCURRENCY || '3',
        KAFKA_AUTO_OFFSET_RESET: process.env.KAFKA_AUTO_OFFSET_RESET || 'earliest',
        KAFKA_MAX_POLL_RECORDS: process.env.KAFKA_MAX_POLL_RECORDS || '500',
        KAFKA_SESSION_TIMEOUT_MS: process.env.KAFKA_SESSION_TIMEOUT_MS || '45000',
        KAFKA_TRUSTED_PACKAGES: process.env.KAFKA_TRUSTED_PACKAGES || 'cl.srmm.kafka.bridge.messaging.dto',
        ANALITICA_WINDOW_DURATION: process.env.ANALITICA_WINDOW_DURATION || 'PT5M'
      }
    }
  ]
};
