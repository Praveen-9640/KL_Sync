const { asyncHandler } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
exports.list = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id,title,message,type,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  const unread = (await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1 AND NOT is_read', [req.user.id])).rows[0].n;
  res.json({ notifications: rows, unread });
});
exports.markRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2', [v.id(req.params.id), req.user.id]);
  res.json({ ok: true });
});
exports.markAllRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
});
