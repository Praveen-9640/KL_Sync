// Integration smoke test. Requires: DB initialised + seeded, server running (npm run dev).
// It creates temporary test users directly in the DB, signs sessions with JWT_SECRET (no OTP involved),
// exercises the main flows, then deletes everything it created. Usage: npm test
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };
const call = async (tok, method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
(async () => {
  const tag = Date.now();
  const mk = async (n, role = 'student') => (await pool.query("INSERT INTO users (full_name,student_id,email,role) VALUES ($1,$2,$3,$4) RETURNING id", [`Test ${n}`, `T${tag}${n}`, `t${tag}${n}@test.local`, role])).rows[0].id;
  const [a, b, adm] = [await mk('A'), await mk('B'), await mk('Adm', 'admin')];
  const tok = (id) => jwt.sign({ sub: id, purpose: 'session' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const [A, B, ADM] = [tok(a), tok(b), tok(adm)];
  try {
    check('health', (await call(null, 'GET', '/health')).status === 200);
    check('protected route needs token', (await call(null, 'GET', '/play')).status === 401);
    check('student blocked from admin API', (await call(B, 'GET', '/admin/stats')).status === 403);
    check('admin can read stats', (await call(ADM, 'GET', '/admin/stats')).status === 200);
    check('forged register token rejected', (await call(null, 'POST', '/auth/register', { registrationToken: 'x', full_name: 'x' })).status === 401);
    check('wrong OTP without request rejected', (await call(null, 'POST', '/auth/verify-otp', { channel: 'email', identifier: 'nobody@test.local', code: '123456' })).status === 400);

    // Play: join until full, status flips
    const pr = await call(A, 'POST', '/play', { game_name: 'Chess', play_date: '2099-01-01', play_time: '18:00', location: 'Games room', players_required: 1 });
    check('create play request', pr.status === 201, JSON.stringify(pr.data));
    check('creator cannot join own request', (await call(A, 'POST', `/play/${pr.data.id}/join`)).status === 400);
    check('join play request', (await call(B, 'POST', `/play/${pr.data.id}/join`)).status === 200);
    check('request becomes full', (await call(A, 'GET', `/play/${pr.data.id}`)).data.request?.status === 'full');
    check('leave reopens request', (await call(B, 'POST', `/play/${pr.data.id}/leave`)).status === 200 && (await call(A, 'GET', `/play/${pr.data.id}`)).data.request?.status === 'open');

    // Marketplace ownership
    const m = await pool.query("INSERT INTO marketplace_items (seller_id,title,category,price,condition,pickup_location) VALUES ($1,'Lamp','Other',100,'Good','B-block') RETURNING id", [a]);
    check('other user cannot mark sold', (await call(B, 'POST', `/market/${m.rows[0].id}/sold`)).status === 403);
    check('other user cannot delete', (await call(B, 'DELETE', `/market/${m.rows[0].id}`)).status === 403);
    check('owner marks sold', (await call(A, 'POST', `/market/${m.rows[0].id}/sold`)).status === 200);

    // Needs: duplicate response blocked
    const n = await call(A, 'POST', '/needs', { item_name: 'Iron', category: 'Appliances', request_type: 'borrow', required_date: '2099-01-01' });
    check('create need', n.status === 201, JSON.stringify(n.data));
    check('respond to need', (await call(B, 'POST', `/needs/${n.data.id}/respond`, { response_type: 'offer' })).status === 201);
    check('duplicate response blocked', (await call(B, 'POST', `/needs/${n.data.id}/respond`, { response_type: 'offer' })).status === 409);

    // Projects: interest + accept
    const p = await call(A, 'POST', '/projects', { title: 'P', description: 'd', domain: 'Other', project_type: 'academic', teammates_needed: 1, current_team_size: 1, required_skills: 'Python' });
    check('create project', p.status === 201, JSON.stringify(p.data));
    check('express interest', (await call(B, 'POST', `/projects/${p.data.id}/interest`, { message: 'hi' })).status === 201);
    const det = await call(A, 'GET', `/projects/${p.data.id}`);
    check('non-creator cannot decide', (await call(B, 'POST', `/projects/${p.data.id}/interests/${det.data.interests[0].id}`, { decision: 'accepted' })).status === 403);
    check('creator accepts', (await call(A, 'POST', `/projects/${p.data.id}/interests/${det.data.interests[0].id}`, { decision: 'accepted' })).status === 200);

    // Rooms: no double booking
    const f = (await pool.query("INSERT INTO flats (block_name,flat_number,floor_number,total_rooms) VALUES ('Z',$1,1,1) RETURNING id", [`Z-${tag}`])).rows[0].id;
    const sem = process.env.CURRENT_SEMESTER || 'Spring 2027';
    const room = (await pool.query("INSERT INTO rooms (flat_id,room_number,capacity,available_beds,semester) VALUES ($1,'Z1',1,1,$2) RETURNING id", [f, sem])).rows[0].id;
    const r1 = await call(A, 'POST', `/rooms/${room}/request`);
    const r2 = await call(B, 'POST', `/rooms/${room}/request`);
    check('both can request', r1.status === 201 && r2.status === 201, JSON.stringify([r1.data, r2.data]));
    check('admin approves first', (await call(ADM, 'POST', `/admin/allocations/${r1.data.allocation.id}`, { action: 'approve' })).status === 200);
    check('second approval blocked (no beds left)', (await call(ADM, 'POST', `/admin/allocations/${r2.data.allocation.id}`, { action: 'approve' })).status === 409);
    const rm = (await pool.query('SELECT available_beds, availability_status FROM rooms WHERE id=$1', [room])).rows[0];
    check('room marked full', rm.available_beds === 0 && rm.availability_status === 'full');
    check('student cannot double-request in a semester', (await call(A, 'POST', `/rooms/${room}/request`)).status === 409);
    await pool.query('DELETE FROM flats WHERE id=$1', [f]);
  } catch (e) { fail++; console.error('Test crashed:', e.message); }
  finally {
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[a, b, adm]]);
    await pool.end();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exitCode = fail ? 1 : 0;
  }
})();
