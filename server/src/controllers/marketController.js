const fs = require('fs');
const path = require('path');
const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
const { notify } = require('../utils/notify');

const CATEGORIES = ['Books', 'Furniture', 'Bedding', 'Appliances', 'Electronics', 'Bicycles', 'Kitchen', 'Storage', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
const SELECT = `SELECT m.id, m.seller_id, m.title, m.category, m.description, m.price::float AS price, m.condition, m.pickup_location, m.image_url, m.status, m.created_at,
  u.full_name AS seller_name, CASE WHEN u.show_phone THEN u.phone END AS seller_phone, CASE WHEN u.show_email THEN u.email END AS seller_email
  FROM marketplace_items m JOIN users u ON u.id=m.seller_id`;
const removeFile = (url) => {
  if (!url) return;
  const f = path.join(__dirname, '..', '..', 'uploads', path.basename(url));
  fs.unlink(f, () => {});
};
const fields = (b) => ({
  title: v.str(b.title, 'Product name', { max: 140 }), category: v.oneOf(b.category, 'Category', CATEGORIES),
  description: v.str(b.description, 'Description', { max: 1000, optional: true }), price: v.num(b.price, 'Price', { max: 10000000 }),
  condition: v.oneOf(b.condition, 'Condition', CONDITIONS), pickup: v.str(b.pickup_location, 'Pickup location', { max: 120 }),
});
exports.meta = (_req, res) => res.json({ categories: CATEGORIES, conditions: CONDITIONS });

exports.create = asyncHandler(async (req, res) => {
  let f;
  try { f = fields(req.body); } catch (e) { if (req.file) removeFile(req.file.filename); throw e; }
  const img = req.file ? `/uploads/${req.file.filename}` : null;
  const { rows } = await query('INSERT INTO marketplace_items (seller_id,title,category,description,price,condition,pickup_location,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [req.user.id, f.title, f.category, f.description, f.price, f.condition, f.pickup, img]);
  res.status(201).json({ id: rows[0].id });
});

exports.list = asyncHandler(async (req, res) => {
  const { q, category, sort, status, mine } = req.query;
  const p = []; const w = [];
  if (mine === 'true') { p.push(req.user.id); w.push(`m.seller_id=$${p.length}`); w.push("m.status<>'removed'"); }
  else if (status === 'sold') w.push("m.status='sold'"); else w.push("m.status='available'");
  if (q) { p.push(`%${String(q).slice(0, 60)}%`); w.push(`(m.title ILIKE $${p.length} OR m.description ILIKE $${p.length})`); }
  if (category) { p.push(category); w.push(`m.category=$${p.length}`); }
  const order = sort === 'price_asc' ? 'm.price ASC' : sort === 'price_desc' ? 'm.price DESC' : 'm.created_at DESC';
  const { rows } = await query(`${SELECT} WHERE ${w.join(' AND ')} ORDER BY ${order} LIMIT 200`, p);
  res.json({ items: rows });
});

exports.get = asyncHandler(async (req, res) => {
  const { rows } = await query(`${SELECT} WHERE m.id=$1 AND m.status<>'removed'`, [v.id(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Listing not found');
  res.json({ item: rows[0] });
});

const ownItem = async (id, userId) => {
  const it = (await query('SELECT * FROM marketplace_items WHERE id=$1 AND status<>$2', [id, 'removed'])).rows[0];
  if (!it) throw new HttpError(404, 'Listing not found');
  if (it.seller_id !== userId) throw new HttpError(403, 'You can only change your own listings');
  return it;
};

exports.update = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  let it, f;
  try { it = await ownItem(id, req.user.id); f = fields(req.body); } catch (e) { if (req.file) removeFile(req.file.filename); throw e; }
  let img = it.image_url;
  if (req.file) { removeFile(it.image_url); img = `/uploads/${req.file.filename}`; }
  else if (req.body.remove_image === 'true') { removeFile(it.image_url); img = null; }
  await query('UPDATE marketplace_items SET title=$1,category=$2,description=$3,price=$4,condition=$5,pickup_location=$6,image_url=$7 WHERE id=$8',
    [f.title, f.category, f.description, f.price, f.condition, f.pickup, img, id]);
  res.json({ message: 'Listing updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  const it = await ownItem(v.id(req.params.id), req.user.id);
  await query('DELETE FROM marketplace_items WHERE id=$1', [it.id]);
  removeFile(it.image_url);
  res.json({ message: 'Listing deleted' });
});

exports.markSold = asyncHandler(async (req, res) => {
  const it = await ownItem(v.id(req.params.id), req.user.id);
  await query("UPDATE marketplace_items SET status='sold' WHERE id=$1", [it.id]);
  res.json({ message: 'Marked as sold' });
});

// In-app contact: tells the seller someone is interested (no contact details exposed).
exports.interest = asyncHandler(async (req, res) => {
  const it = (await query("SELECT seller_id, title FROM marketplace_items WHERE id=$1 AND status='available'", [v.id(req.params.id)])).rows[0];
  if (!it) throw new HttpError(404, 'Listing not available');
  if (it.seller_id === req.user.id) throw new HttpError(400, 'This is your own listing');
  const me = (await query('SELECT full_name, hostel_block, room_number FROM users WHERE id=$1', [req.user.id])).rows[0];
  const note = v.str(req.body.message, 'Message', { max: 300, optional: true });
  await notify(it.seller_id, 'Interest in your listing', `${me.full_name}${me.hostel_block ? ` (Block ${me.hostel_block}, Room ${me.room_number || '-'})` : ''} is interested in "${it.title}".${note ? ` Message: ${note}` : ''}`, 'market');
  res.json({ message: 'The seller has been notified' });
});
