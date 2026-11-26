const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
const { semester: CURRENT } = require('../config/env');
const roomSvc = require('../services/roomService');
const { notify } = require('../utils/notify');

exports.listFlats = asyncHandler(async (req, res) => {
  const { block, floor, balcony_direction, facility, q, only_available } = req.query;
  const p = []; const w = [];
  if (block) { p.push(block); w.push(`f.block_name = $${p.length}`); }
  if (floor !== undefined && floor !== '') { p.push(v.int(floor, 'floor')); w.push(`f.floor_number = $${p.length}`); }
  if (balcony_direction) { p.push(balcony_direction); w.push(`f.balcony_direction = $${p.length}`); }
  if (facility) { p.push(facility); w.push(`($${p.length} = ANY(f.facilities) OR EXISTS (SELECT 1 FROM rooms rr WHERE rr.flat_id=f.id AND $${p.length} = ANY(rr.facilities)))`); }
  if (q) { p.push(`%${String(q).slice(0, 50)}%`); w.push(`(f.flat_number ILIKE $${p.length} OR EXISTS (SELECT 1 FROM rooms rr WHERE rr.flat_id=f.id AND rr.room_number ILIKE $${p.length}))`); }
  p.push(CURRENT);
  const sem = `$${p.length}`;
  const sql = `SELECT f.*, COUNT(r.id)::int AS room_count, COALESCE(SUM(r.available_beds),0)::int AS available_beds,
      COALESCE(json_agg(json_build_object('id',r.id,'room_number',r.room_number,'available_beds',r.available_beds,'capacity',r.capacity,'availability_status',r.availability_status) ORDER BY r.room_number) FILTER (WHERE r.id IS NOT NULL), '[]') AS rooms
    FROM flats f LEFT JOIN rooms r ON r.flat_id=f.id AND r.semester=${sem}
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} GROUP BY f.id
    ${only_available === 'true' ? 'HAVING COALESCE(SUM(r.available_beds),0) > 0' : ''}
    ORDER BY f.block_name, f.floor_number, f.flat_number`;
  const { rows } = await query(sql, p);
  res.json({ semester: CURRENT, flats: rows });
});

exports.getFlat = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const flat = (await query('SELECT * FROM flats WHERE id=$1', [id])).rows[0];
  if (!flat) throw new HttpError(404, 'Flat not found');
  const rooms = (await query('SELECT * FROM rooms WHERE flat_id=$1 AND semester=$2 ORDER BY room_number', [id, CURRENT])).rows;
  res.json({ flat, rooms, semester: CURRENT });
});

exports.listRooms = asyncHandler(async (req, res) => {
  const { available, block, floor, balcony_direction } = req.query;
  const p = [CURRENT]; const w = ['r.semester=$1'];
  if (available === 'true') w.push("r.availability_status='available' AND r.available_beds>0");
  if (block) { p.push(block); w.push(`f.block_name=$${p.length}`); }
  if (floor !== undefined && floor !== '') { p.push(v.int(floor, 'floor')); w.push(`f.floor_number=$${p.length}`); }
  if (balcony_direction) { p.push(balcony_direction); w.push(`f.balcony_direction=$${p.length}`); }
  const { rows } = await query(`SELECT r.*, f.flat_number, f.block_name, f.floor_number, f.balcony_available, f.balcony_direction, f.kitchen, f.bathroom_type
    FROM rooms r JOIN flats f ON f.id=r.flat_id WHERE ${w.join(' AND ')} ORDER BY f.block_name, f.flat_number, r.room_number`, p);
  res.json({ rooms: rows });
});

exports.getRoom = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT r.*, f.flat_number, f.block_name, f.floor_number, f.balcony_available, f.balcony_direction, f.kitchen, f.bathroom_type, f.bathroom_details
    FROM rooms r JOIN flats f ON f.id=r.flat_id WHERE r.id=$1`, [v.id(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Room not found');
  res.json({ room: rows[0] });
});

exports.requestRoom = asyncHandler(async (req, res) => {
  const roomId = v.id(req.params.id);
  const room = (await query('SELECT * FROM rooms WHERE id=$1', [roomId])).rows[0];
  if (!room) throw new HttpError(404, 'Room not found');
  if (room.semester !== CURRENT) throw new HttpError(400, `Rooms can only be requested for ${CURRENT}`);
  if (room.availability_status !== 'available' || room.available_beds < 1) throw new HttpError(409, 'This room has no free beds');
  let row;
  try {
    row = (await query('INSERT INTO room_allocations (user_id, room_id, semester) VALUES ($1,$2,$3) RETURNING *', [req.user.id, roomId, CURRENT])).rows[0];
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'You already have an open room request or allocation for this semester. Cancel it first to choose another room.');
    throw e;
  }
  const admins = (await query("SELECT id FROM users WHERE role='admin'")).rows;
  await Promise.all(admins.map((a) => notify(a.id, 'New room request', `A student requested room ${room.room_number}.`, 'room')));
  res.status(201).json({ allocation: row, message: 'Request sent. Hostel management will confirm your allocation.' });
});

exports.myAllocations = asyncHandler(async (req, res) => {
  const { rows } = await roomSvc.listAllocations('WHERE al.user_id=$1', [req.user.id]);
  res.json({ allocations: rows });
});

exports.cancelMyAllocation = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const own = (await query('SELECT user_id FROM room_allocations WHERE id=$1', [id])).rows[0];
  if (!own) throw new HttpError(404, 'Request not found');
  if (own.user_id !== req.user.id) throw new HttpError(403, 'Not your request');
  res.json(await roomSvc.releaseAllocation(id, 'cancelled'));
});
