const { Pool } = require('pg');
const { databaseUrl } = require('./env');
const pool = new Pool({ connectionString: databaseUrl });
const query = (text, params) => pool.query(text, params);
/** Run fn(client) inside a transaction. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
module.exports = { pool, query, withTransaction };
