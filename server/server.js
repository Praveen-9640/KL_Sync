const app = require('./src/app');
const { port, validateEnv } = require('./src/config/env');
const { pool } = require('./src/config/db');

validateEnv();
pool.query('SELECT 1').then(() => {
  app.listen(port, () => console.log(`HostelHub API running on http://localhost:${port}`));
}).catch((e) => {
  console.error('Cannot connect to PostgreSQL. Check DATABASE_URL in server/.env:', e.message);
  process.exit(1);
});
