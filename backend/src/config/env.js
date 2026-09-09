import 'dotenv/config';

const requiredForAzure = ['AZURE_TENANT_ID', 'AZURE_API_AUDIENCE'];
const azureValuesPresent = requiredForAzure.every((key) => Boolean(process.env[key]));

export const env = {
  port: Number(process.env.PORT || 3001),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  azureAuthEnabled: process.env.AZURE_AUTH_ENABLED === 'true' && azureValuesPresent,
  azureTenantId: process.env.AZURE_TENANT_ID || '',
  azureAudience: process.env.AZURE_API_AUDIENCE || '',
  azureApiClientId: process.env.AZURE_API_CLIENT_ID || '',
  azureRequiredScope: process.env.AZURE_REQUIRED_SCOPE || '',
  databaseEnabled: process.env.DATABASE_ENABLED === 'true',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'srmm_cloud',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  }
};
