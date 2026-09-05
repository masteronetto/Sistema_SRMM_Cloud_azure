import 'dotenv/config';

const requiredForAzure = ['AZURE_TENANT_ID', 'AZURE_API_AUDIENCE'];
const azureValuesPresent = requiredForAzure.every((key) => Boolean(process.env[key]));

export const env = {
  port: Number(process.env.PORT || 3001),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  azureAuthEnabled: process.env.AZURE_AUTH_ENABLED === 'true' && azureValuesPresent,
  azureTenantId: process.env.AZURE_TENANT_ID || '',
  azureAudience: process.env.AZURE_API_AUDIENCE || '',
  azureRequiredScope: process.env.AZURE_REQUIRED_SCOPE || ''
};
