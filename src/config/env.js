const dotenv = require('dotenv');

dotenv.config();

const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const databaseEnabled = process.env.DATABASE_ENABLED === 'true';
const hasDatabaseConfig = databaseEnabled && requiredVars.every((key) => Boolean(process.env[key]));
const hasDatabaseUrl = databaseEnabled && Boolean(process.env.DATABASE_URL);

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseEnabled,
  hasDatabaseConfig,
  hasDatabaseUrl,
  db: hasDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
      }
    : hasDatabaseConfig
    ? {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      }
    : null
};
