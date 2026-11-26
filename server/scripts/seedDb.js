// Seeds sample flats/rooms and (if ADMIN_EMAIL is set) the admin account. Usage: npm run db:seed
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'seed.sql'), 'utf8'));
    console.log('Sample flats and rooms inserted (semester label in seed.sql: Spring 2027).');
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!email) console.log('ADMIN_EMAIL not set: no admin created. Set it in server/.env and re-run to create one.');
    else {
      await pool.query(
        `INSERT INTO users (full_name, student_id, email, role) VALUES ($1,$2,$3,'admin')
         ON CONFLICT (email) DO UPDATE SET role='admin'`,
        [process.env.ADMIN_NAME || 'Hostel Admin', process.env.ADMIN_STUDENT_ID || 'ADMIN001', email]);
      console.log(`Admin account ready for ${email}. Log in with an email OTP.`);
    }
  } catch (e) { console.error('Seeding failed:', e.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();
