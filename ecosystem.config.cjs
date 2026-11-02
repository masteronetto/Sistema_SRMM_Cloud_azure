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
    }
  ]
};
