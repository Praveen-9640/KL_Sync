const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
const { notify } = require('../utils/notify');
const { publicUser } = require('../utils/publicUser');

const CATEGORIES = ['Appliances', 'Books', 'Electronics', 'Stationery', 'Sports', 'Clothing', 'Kitchen', 'Other'];
const BASE = `SELECT n.id, n.user_id, n.item_name, n.category, n.request_type, to_char(n.required_date,'YYYY-MM-DD') AS required_date, n.duration, n.location, n.description, n.status, n.created_at,
  u.full_name AS requester_name,
  (SELECT COUNT(*)::int FROM need_responses r WHERE r.need_id=n.id) AS response_count,
  (SELECT r.response_type FROM need_responses r WHERE r.need_id=n.id AND r.responder_id=$1) AS my_response
  FROM hostel_needs n JOIN users u ON u.id=n.user_id`;

exports.meta = (_req, res) => res.json({ categories: CATEGORIES });
exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  const d = [v.str(b.item_name, 'Item name', { max: 120 }), v.oneOf(b.category, 'Category', CATEGORIES), v.oneOf(b.request_type, 'Request type', ['borrow', 'buy']),
    v.date(b.required_date, 'Required date'), v.str(b.duration, 'Duration', { max: 60, optional: true }), v.str(b.location, 'Location', { max: 120, optional: true }), v.str(b.description, 'Description', { max: 500, optional: true })];
  const { rows } = await query('INSERT INTO hostel_needs (user_id,item_name,category,request_type,required_date,duration,location,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [req.user.id, ...d]);
  res.status(201).json({ id: rows[0].id });
});
exports.list = asyncHandler(async (req, res) => {
  const { q, category, status, mine } = req.query;
  const p = [req.user.id]; const w = [];
  if (mine === 'true') w.push('n.user_id=$1'); else w.push(`n.status=${status === 'fulfilled' ? "'fulfilled'" : "'open'"}`);
  if (q) { p.push(`%${String(q).slice(0, 60)}%`); w.push(`n.item_name ILIKE $${p.length}`); }
  if (category) { p.push(category); w.push(`n.category=$${p.length}`); }
  const { rows } = await query(`${BASE} WHERE ${w.join(' AND ')} ORDER BY n.required_date, n.created_at DESC LIMIT 200`, p);
  res.json({ needs: rows });
});
exports.get = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const need = (await query(`${BASE} WHERE n.id=$2`, [req.user.id, id])).rows[0];
  if (!need) throw new HttpError(404, 'Request not found');
  // Requester sees everyone's responses (with opted-in contact); others see only their own.
  const rs = (await query(`SELECT r.id, r.response_type, r.response_message, r.created_at, r.responder_id, u.* FROM need_responses r JOIN users u ON u.id=r.responder_id
    WHERE r.need_id=$1 AND ($2 OR r.responder_id=$3) ORDER BY r.created_at`, [id, need.user_id === req.user.id, req.user.id])).rows;
  res.json({ need, responses: rs.map((r) => ({ id: r.id, response_type: r.response_type, response_message: r.response_message, created_at: r.created_at, responder: publicUser({ ...r, id: r.responder_id }) })) });
});
exports.respond = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const need = (await query('SELECT * FROM hostel_needs WHERE id=$1', [id])).rows[0];
  if (!need) throw new HttpError(404, 'Request not found');
  if (need.user_id === req.user.id) throw new HttpError(400, 'You cannot respond to your own request');
  if (need.status !== 'open') throw new HttpError(409, 'This request is no longer open');
  const type = v.oneOf(req.body.response_type, 'Response type', ['offer', 'interest', 'reaction']);
  const msg = v.str(req.body.response_message, 'Message', { max: 300, optional: true });
  try { await query('INSERT INTO need_responses (need_id,responder_id,response_message,response_type) VALUES ($1,$2,$3,$4)', [id, req.user.id, msg, type]); }
  catch (e) { if (e.code === '23505') throw new HttpError(409, 'You have already responded to this request'); throw e; }
  const me = (await query('SELECT full_name, hostel_block, room_number FROM users WHERE id=$1', [req.user.id])).rows[0];
  const verb = type === 'offer' ? 'offered to help with' : type === 'interest' ? 'is interested in' : 'reacted to';
  await notify(need.user_id, 'New response to your request', `${me.full_name}${me.hostel_block ? ` (Block ${me.hostel_block}, Room ${me.room_number || '-'})` : ''} ${verb} "${need.item_name}".${msg ? ` "${msg}"` : ''}`, 'need');
  res.status(201).json({ message: 'Response sent' });
});
exports.fulfill = asyncHandler(async (req, res) => {
  const { rows } = await query("UPDATE hostel_needs SET status='fulfilled' WHERE id=$1 AND user_id=$2 AND status='open' RETURNING id", [v.id(req.params.id), req.user.id]);
  if (!rows[0]) throw new HttpError(403, 'Only the requester can mark an open request as fulfilled');
  res.json({ message: 'Marked as fulfilled' });
});
exports.remove = asyncHandler(async (req, res) => {
  const { rowCount } = await query('DELETE FROM hostel_needs WHERE id=$1 AND user_id=$2', [v.id(req.params.id), req.user.id]);
  if (!rowCount) throw new HttpError(403, 'You can only delete your own requests');
  res.json({ message: 'Request deleted' });
});
