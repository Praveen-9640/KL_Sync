// Creates all tables from database/schema.sql. Usage: npm run db:init
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8'));
    console.log('Database schema is ready.');
  } catch (e) { console.error('Schema creation failed:', e.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();
