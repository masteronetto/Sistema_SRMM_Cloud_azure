const { Pool } = require('pg');
const { db } = require('../config/env');

const pool = new Pool(db || undefined);

pool.on('error', (error) => {
	console.error('Error inesperado en cliente idle de PostgreSQL:', error);
});

module.exports = pool;
