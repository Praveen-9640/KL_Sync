const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
const { semester: CURRENT } = require('../config/env');
const roomSvc = require('../services/roomService');
const { notify } = require('../utils/notify');

const DIRS = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
const flatFields = (b) => {
  const balcony = v.bool(b.balcony_available);
  return [v.str(b.block_name, 'Block', { max: 20 }), v.str(b.flat_number, 'Flat number', { max: 20 }), v.int(b.floor_number, 'Floor', { min: 0, max: 50 }), v.int(b.total_rooms, 'Total rooms', { min: 1, max: 20 }),
    balcony, balcony ? v.oneOf(b.balcony_direction, 'Balcony direction', DIRS, { optional: true }) : null, v.oneOf(b.kitchen || 'None', 'Kitchen', ['None', 'Shared', 'Private']),
    v.oneOf(b.bathroom_type || 'Common', 'Bathroom type', ['Common', 'Attached', 'Mixed']), v.str(b.bathroom_details, 'Bathroom details', { max: 300, optional: true }), v.list(b.facilities, 'Facilities'), v.str(b.description, 'Description', { max: 1000, optional: true })];
};
const roomFields = (b) => {
  const capacity = v.int(b.capacity, 'Capacity', { min: 1, max: 12 });
  const avail = v.int(b.available_beds ?? capacity, 'Available beds', { min: 0, max: capacity });
  return [v.str(b.room_number, 'Room number', { max: 20 }), v.str(b.room_type || 'Shared', 'Room type', { max: 30 }), capacity, avail, v.oneOf(b.window_direction, 'Window direction', DIRS, { optional: true }),
    v.bool(b.attached_bathroom), v.list(b.facilities, 'Facilities'), v.str(b.semester || CURRENT, 'Semester', { max: 30 }), v.oneOf(b.availability_status || (avail > 0 ? 'available' : 'full'), 'Status', ['available', 'full', 'blocked']), v.str(b.description, 'Description', { max: 1000, optional: true })];
};
exports.stats = asyncHandler(async (_req, res) => {
  const { rows } = await query(`SELECT (SELECT COUNT(*)::int FROM users WHERE role='student') AS students, (SELECT COUNT(*)::int FROM flats) AS flats, (SELECT COUNT(*)::int FROM rooms) AS rooms,
    (SELECT COUNT(*)::int FROM room_allocations WHERE allocation_status='requested') AS pending_requests, (SELECT COUNT(*)::int FROM reports WHERE status='open') AS open_reports,
    (SELECT COUNT(*)::int FROM marketplace_items WHERE status='available') AS active_listings`);
  res.json(rows[0]);
});
exports.createFlat = asyncHandler(async (req, res) => {
  const { rows } = await query('INSERT INTO flats (block_name,flat_number,floor_number,total_rooms,balcony_available,balcony_direction,kitchen,bathroom_type,bathroom_details,facilities,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', flatFields(req.body));
  res.status(201).json({ flat: rows[0] });
});
exports.updateFlat = asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE flats SET block_name=$1,flat_number=$2,floor_number=$3,total_rooms=$4,balcony_available=$5,balcony_direction=$6,kitchen=$7,bathroom_type=$8,bathroom_details=$9,facilities=$10,description=$11 WHERE id=$12 RETURNING *', [...flatFields(req.body), v.id(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Flat not found');
  res.json({ flat: rows[0] });
});
exports.createRoom = asyncHandler(async (req, res) => {
  const flatId = v.id(req.params.flatId);
  const { rows } = await query('INSERT INTO rooms (flat_id,room_number,room_type,capacity,available_beds,window_direction,attached_bathroom,facilities,semester,availability_status,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [flatId, ...roomFields(req.body)]);
  res.status(201).json({ room: rows[0] });
});
exports.updateRoom = asyncHandler(async (req, res) => {
  const { rows } = await query('UPDATE rooms SET room_number=$1,room_type=$2,capacity=$3,available_beds=$4,window_direction=$5,attached_bathroom=$6,facilities=$7,semester=$8,availability_status=$9,description=$10 WHERE id=$11 RETURNING *', [...roomFields(req.body), v.id(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Room not found');
  res.json({ room: rows[0] });
});
exports.listAllocations = asyncHandler(async (req, res) => {
  const s = req.query.status;
  const { rows } = s ? await roomSvc.listAllocations('WHERE al.allocation_status=$1', [s]) : await roomSvc.listAllocations();
  res.json({ allocations: rows });
});
exports.decideAllocation = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const action = v.oneOf(req.body.action, 'Action', ['approve', 'reject', 'cancel']);
  if (action === 'approve') return res.json(await roomSvc.approveAllocation(id));
  if (action === 'reject') return res.json(await roomSvc.releaseAllocation(id, 'rejected', 'Your room request was not approved. You can choose another room.'));
  res.json(await roomSvc.releaseAllocation(id, 'cancelled', 'Your room allocation was cancelled by hostel management.'));
});
exports.users = asyncHandler(async (req, res) => {
  const q = req.query.q ? `%${String(req.query.q).slice(0, 60)}%` : '%';
  const { rows } = await query('SELECT id,full_name,student_id,email,phone,college,hostel_block,flat_number,room_number,role,created_at FROM users WHERE full_name ILIKE $1 OR student_id ILIKE $1 ORDER BY created_at DESC LIMIT 200', [q]);
  res.json({ users: rows });
});
exports.listings = asyncHandler(async (_req, res) => {
  const { rows } = await query("SELECT m.id,m.title,m.category,m.price::float AS price,m.status,m.created_at,u.full_name AS seller_name FROM marketplace_items m JOIN users u ON u.id=m.seller_id WHERE m.status<>'removed' ORDER BY m.created_at DESC LIMIT 200");
  res.json({ items: rows });
});
exports.removeListing = asyncHandler(async (req, res) => {
  const { rows } = await query("UPDATE marketplace_items SET status='removed' WHERE id=$1 RETURNING seller_id,title", [v.id(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Listing not found');
  await notify(rows[0].seller_id, 'Listing removed', `"${rows[0].title}" was removed by hostel management.`, 'market');
  res.json({ message: 'Listing removed' });
});
exports.reports = asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT r.*, u.full_name AS reporter_name FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY (r.status=\'open\') DESC, r.created_at DESC LIMIT 200');
  res.json({ reports: rows });
});
exports.resolveReport = asyncHandler(async (req, res) => {
  const status = v.oneOf(req.body.status, 'Status', ['resolved', 'dismissed']);
  const { rowCount } = await query('UPDATE reports SET status=$1 WHERE id=$2', [status, v.id(req.params.id)]);
  if (!rowCount) throw new HttpError(404, 'Report not found');
  res.json({ message: `Report ${status}` });
});
