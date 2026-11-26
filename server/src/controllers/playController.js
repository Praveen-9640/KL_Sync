const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query, withTransaction } = require('../config/db');
const { notify } = require('../utils/notify');
const { publicUser } = require('../utils/publicUser');

const BASE = `SELECT p.id, p.user_id, p.game_name, to_char(p.play_date,'YYYY-MM-DD') AS play_date, to_char(p.play_time,'HH24:MI') AS play_time,
  p.location, p.players_required, p.description, p.status, p.created_at, u.full_name AS creator_name,
  (SELECT COUNT(*)::int FROM play_participants pp WHERE pp.play_request_id=p.id) AS joined_count,
  EXISTS (SELECT 1 FROM play_participants pp WHERE pp.play_request_id=p.id AND pp.user_id=$1) AS joined
  FROM play_requests p JOIN users u ON u.id=p.user_id`;

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  const d = { game: v.str(b.game_name, 'Game', { max: 60 }), date: v.date(b.play_date, 'Date'), time: v.time(b.play_time, 'Time'),
    loc: v.str(b.location, 'Location', { max: 120 }), n: v.int(b.players_required, 'Players required', { min: 1, max: 20 }), desc: v.str(b.description, 'Description', { max: 500, optional: true }) };
  const { rows } = await query('INSERT INTO play_requests (user_id,game_name,play_date,play_time,location,players_required,description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [req.user.id, d.game, d.date, d.time, d.loc, d.n, d.desc]);
  res.status(201).json({ id: rows[0].id });
});

exports.list = asyncHandler(async (req, res) => {
  const { game, status, mine } = req.query;
  const p = [req.user.id]; const w = [];
  if (game) { p.push(`%${String(game).slice(0, 50)}%`); w.push(`p.game_name ILIKE $${p.length}`); }
  if (status) { p.push(status); w.push(`p.status=$${p.length}`); } else w.push("p.status IN ('open','full')");
  if (mine === 'true') w.push('(p.user_id=$1 OR EXISTS (SELECT 1 FROM play_participants x WHERE x.play_request_id=p.id AND x.user_id=$1))');
  else w.push('(p.play_date >= CURRENT_DATE)');
  const { rows } = await query(`${BASE} WHERE ${w.join(' AND ')} ORDER BY p.play_date, p.play_time`, p);
  res.json({ requests: rows });
});

exports.get = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const row = (await query(`${BASE} WHERE p.id=$2`, [req.user.id, id])).rows[0];
  if (!row) throw new HttpError(404, 'Play request not found');
  const parts = (await query('SELECT u.*, pp.joined_at FROM play_participants pp JOIN users u ON u.id=pp.user_id WHERE pp.play_request_id=$1 ORDER BY pp.joined_at', [id])).rows;
  const isMember = row.user_id === req.user.id || row.joined;
  // Participants (and contact details they opted to share) are visible to the creator and other participants only.
  res.json({ request: row, participants: isMember ? parts.map((u) => ({ ...publicUser(u), joined_at: u.joined_at })) : [] });
});

exports.join = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const out = await withTransaction(async (db) => {
    const p = (await db.query('SELECT * FROM play_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!p) throw new HttpError(404, 'Play request not found');
    if (p.user_id === req.user.id) throw new HttpError(400, 'You created this request');
    if (p.status !== 'open') throw new HttpError(409, p.status === 'full' ? 'This game is already full' : 'This request is no longer open');
    const cnt = (await db.query('SELECT COUNT(*)::int AS n FROM play_participants WHERE play_request_id=$1', [id])).rows[0].n;
    if (cnt >= p.players_required) throw new HttpError(409, 'This game is already full');
    try { await db.query('INSERT INTO play_participants (play_request_id,user_id) VALUES ($1,$2)', [id, req.user.id]); }
    catch (e) { if (e.code === '23505') throw new HttpError(409, 'You already joined'); throw e; }
    const me = (await db.query('SELECT full_name FROM users WHERE id=$1', [req.user.id])).rows[0];
    const full = cnt + 1 >= p.players_required;
    if (full) await db.query("UPDATE play_requests SET status='full' WHERE id=$1", [id]);
    await notify(p.user_id, full ? 'Your game is full' : 'Someone joined your game', `${me.full_name} joined ${p.game_name}.${full ? ' All spots are filled.' : ''}`, 'play', db);
    return { status: full ? 'full' : 'open' };
  });
  res.json(out);
});

exports.leave = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  await withTransaction(async (db) => {
    const p = (await db.query('SELECT * FROM play_requests WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!p) throw new HttpError(404, 'Play request not found');
    const del = await db.query('DELETE FROM play_participants WHERE play_request_id=$1 AND user_id=$2', [id, req.user.id]);
    if (!del.rowCount) throw new HttpError(400, 'You have not joined this request');
    if (p.status === 'full') await db.query("UPDATE play_requests SET status='open' WHERE id=$1", [id]);
    const me = (await db.query('SELECT full_name FROM users WHERE id=$1', [req.user.id])).rows[0];
    await notify(p.user_id, 'A player left', `${me.full_name} left ${p.game_name}.`, 'play', db);
  });
  res.json({ message: 'You left the request' });
});

exports.cancel = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const { rows } = await query("UPDATE play_requests SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status IN ('open','full') RETURNING game_name", [id, req.user.id]);
  if (!rows[0]) {
    const ex = (await query('SELECT user_id FROM play_requests WHERE id=$1', [id])).rows[0];
    if (!ex) throw new HttpError(404, 'Play request not found');
    throw new HttpError(ex.user_id === req.user.id ? 409 : 403, ex.user_id === req.user.id ? 'Request already closed' : 'Only the creator can cancel this request');
  }
  const parts = (await query('SELECT user_id FROM play_participants WHERE play_request_id=$1', [id])).rows;
  await Promise.all(parts.map((p) => notify(p.user_id, 'Game cancelled', `${rows[0].game_name} was cancelled by the organiser.`, 'play')));
  res.json({ message: 'Request cancelled' });
});
