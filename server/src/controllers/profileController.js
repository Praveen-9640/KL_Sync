const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
const { SELF_COLS, publicUser } = require('../utils/publicUser');

const activity = async (uid) => {
  const [l, p, pr] = await Promise.all([
    query("SELECT id,title,price::float AS price,status FROM marketplace_items WHERE seller_id=$1 AND status='available' ORDER BY created_at DESC", [uid]),
    query("SELECT id,game_name,to_char(play_date,'YYYY-MM-DD') AS play_date,to_char(play_time,'HH24:MI') AS play_time,status FROM play_requests WHERE user_id=$1 AND status IN ('open','full') ORDER BY play_date", [uid]),
    query("SELECT id,title,status FROM projects WHERE creator_id=$1 AND status='open' ORDER BY created_at DESC", [uid]),
  ]);
  return { listings: l.rows, play_requests: p.rows, projects: pr.rows };
};
exports.getMe = asyncHandler(async (req, res) => {
  const user = (await query(`SELECT ${SELF_COLS} FROM users WHERE id=$1`, [req.user.id])).rows[0];
  res.json({ user, activity: await activity(req.user.id) });
});
exports.updateMe = asyncHandler(async (req, res) => {
  const b = req.body;
  const d = [v.str(b.full_name, 'Full name', { max: 120 }), v.str(b.college, 'College', { max: 150, optional: true }), v.str(b.department, 'Department', { max: 120, optional: true }),
    v.str(b.academic_year, 'Academic year', { max: 20, optional: true }), v.str(b.hostel_name, 'Hostel', { max: 120, optional: true }), v.list(b.skills, 'Skills'), v.list(b.interests, 'Interests'),
    v.bool(b.show_email), v.bool(b.show_phone)];
  // Block/flat/room are set by hostel allocation; students cannot overwrite official room data once allocated.
  const alloc = (await query("SELECT 1 FROM room_allocations WHERE user_id=$1 AND allocation_status='allocated'", [req.user.id])).rowCount;
  const loc = alloc ? [null, null, null] : [v.str(b.hostel_block, 'Block', { max: 20, optional: true }), v.str(b.flat_number, 'Flat', { max: 20, optional: true }), v.str(b.room_number, 'Room', { max: 20, optional: true })];
  const { rows } = await query(
    `UPDATE users SET full_name=$1,college=$2,department=$3,academic_year=$4,hostel_name=$5,skills=$6,interests=$7,show_email=$8,show_phone=$9,
      hostel_block=CASE WHEN $10::boolean THEN hostel_block ELSE $11 END, flat_number=CASE WHEN $10::boolean THEN flat_number ELSE $12 END,
      room_number=CASE WHEN $10::boolean THEN room_number ELSE $13 END, updated_at=NOW() WHERE id=$14 RETURNING ${SELF_COLS}`,
    [...d, Boolean(alloc), ...loc, req.user.id]);
  res.json({ user: rows[0] });
});
exports.setTheme = asyncHandler(async (req, res) => {
  const theme = v.oneOf(req.body.theme, 'Theme', ['classic', 'decent', 'simple', 'normal']);
  await query('UPDATE users SET theme=$1 WHERE id=$2', [theme, req.user.id]);
  res.json({ theme });
});
exports.getUser = asyncHandler(async (req, res) => {
  const u = (await query('SELECT * FROM users WHERE id=$1', [v.id(req.params.id)])).rows[0];
  if (!u) throw new HttpError(404, 'User not found');
  res.json({ user: publicUser(u) });
});
exports.dashboard = asyncHandler(async (req, res) => {
  const uid = req.user.id;
  const [c, recent] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*)::int FROM rooms WHERE availability_status='available' AND available_beds>0) AS rooms_available,
      (SELECT COUNT(*)::int FROM play_requests WHERE status='open' AND play_date>=CURRENT_DATE) AS play_open,
      (SELECT COUNT(*)::int FROM marketplace_items WHERE status='available') AS market_items,
      (SELECT COUNT(*)::int FROM hostel_needs WHERE status='open') AS needs_open,
      (SELECT COUNT(*)::int FROM projects WHERE status='open') AS projects_open,
      (SELECT COUNT(*)::int FROM notifications WHERE user_id=$1 AND NOT is_read) AS unread`, [uid]),
    query(`(SELECT 'Play' AS kind, game_name AS title, created_at, '/play' AS link FROM play_requests WHERE status IN ('open','full') ORDER BY created_at DESC LIMIT 4)
      UNION ALL (SELECT 'Marketplace', title, created_at, '/market' FROM marketplace_items WHERE status='available' ORDER BY created_at DESC LIMIT 4)
      UNION ALL (SELECT 'Need', item_name, created_at, '/needs' FROM hostel_needs WHERE status='open' ORDER BY created_at DESC LIMIT 4)
      UNION ALL (SELECT 'Project', title, created_at, '/projects' FROM projects WHERE status='open' ORDER BY created_at DESC LIMIT 4)
      ORDER BY created_at DESC LIMIT 8`),
  ]);
  res.json({ counts: c.rows[0], recent: recent.rows });
});
