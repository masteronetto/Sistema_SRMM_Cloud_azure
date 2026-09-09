import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;
export const pool = env.databaseEnabled ? new Pool(env.database) : null;

export function requireDatabase() {
  if (!pool) {
    const error = new Error('La base de datos no esta habilitada en este entorno.');
    error.statusCode = 503;
    throw error;
  }
  return pool;
}
