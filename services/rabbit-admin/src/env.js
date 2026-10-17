import 'dotenv/config';

const required = ['AZURE_TENANT_ID', 'AZURE_API_AUDIENCE'];

export const env = {
  port: Number(process.env.RABBIT_ADMIN_PORT || 3002),
  rabbitUrl: process.env.RABBITMQ_URL || 'amqp://srmm:local_dev_only@127.0.0.1:5672',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  azureAuthEnabled: process.env.AZURE_AUTH_ENABLED === 'true'
    && required.every((key) => Boolean(process.env[key])),
  azureTenantId: process.env.AZURE_TENANT_ID || '',
  azureAudience: process.env.AZURE_API_AUDIENCE || '',
  azureRequiredScope: process.env.AZURE_REQUIRED_SCOPE || ''
};
