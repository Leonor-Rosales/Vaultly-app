const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5433),
  database: process.env.DB_NAME || 'vaultly_db',
  user: process.env.DB_USER || 'vaultly_admin',
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
