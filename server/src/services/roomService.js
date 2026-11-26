const { withTransaction, query } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const { notify } = require('../utils/notify');

/** Approve a requested allocation. Row-locks the room so two admins/requests cannot overbook it. */
async function approveAllocation(allocationId) {
  return withTransaction(async (db) => {
    const a = (await db.query('SELECT * FROM room_allocations WHERE id=$1 FOR UPDATE', [allocationId])).rows[0];
    if (!a) throw new HttpError(404, 'Allocation not found');
    if (a.allocation_status !== 'requested') throw new HttpError(409, `Allocation is already ${a.allocation_status}`);
    const room = (await db.query('SELECT r.*, f.flat_number, f.block_name FROM rooms r JOIN flats f ON f.id=r.flat_id WHERE r.id=$1 FOR UPDATE OF r', [a.room_id])).rows[0];
    if (room.availability_status === 'blocked') throw new HttpError(409, 'Room is blocked');
    if (room.available_beds < 1) throw new HttpError(409, 'No beds left in this room');
    const left = room.available_beds - 1;
    await db.query('UPDATE rooms SET available_beds=$1, availability_status=$2 WHERE id=$3', [left, left === 0 ? 'full' : 'available', room.id]);
    await db.query("UPDATE room_allocations SET allocation_status='allocated', allocated_at=NOW() WHERE id=$1", [a.id]);
    await db.query('UPDATE users SET hostel_block=$1, flat_number=$2, room_number=$3, updated_at=NOW() WHERE id=$4', [room.block_name, room.flat_number, room.room_number, a.user_id]);
    await notify(a.user_id, 'Room allocated', `You have been allocated room ${room.room_number} in flat ${room.flat_number} for ${a.semester}.`, 'room', db);
    return { id: a.id, status: 'allocated' };
  });
}

/** Reject a request, or cancel (frees the bed if it was allocated). */
async function releaseAllocation(allocationId, newStatus, actorMessage) {
  return withTransaction(async (db) => {
    const a = (await db.query('SELECT * FROM room_allocations WHERE id=$1 FOR UPDATE', [allocationId])).rows[0];
    if (!a) throw new HttpError(404, 'Allocation not found');
    if (!['requested', 'allocated'].includes(a.allocation_status)) throw new HttpError(409, `Allocation is already ${a.allocation_status}`);
    if (a.allocation_status === 'allocated') {
      await db.query('SELECT id FROM rooms WHERE id=$1 FOR UPDATE', [a.room_id]);
      await db.query(`UPDATE rooms SET available_beds = LEAST(capacity, available_beds + 1),
        availability_status = CASE WHEN availability_status='full' THEN 'available' ELSE availability_status END WHERE id=$1`, [a.room_id]);
    }
    await db.query('UPDATE room_allocations SET allocation_status=$1 WHERE id=$2', [newStatus, a.id]);
    if (actorMessage) await notify(a.user_id, 'Room request update', actorMessage, 'room', db);
    return { id: a.id, status: newStatus };
  });
}
const listAllocations = (where = '', params = []) => query(
  `SELECT al.id, al.semester, al.allocation_status, al.requested_at, al.allocated_at, al.user_id,
          u.full_name, u.student_id, r.id AS room_id, r.room_number, f.flat_number, f.block_name, f.floor_number
   FROM room_allocations al JOIN users u ON u.id=al.user_id JOIN rooms r ON r.id=al.room_id JOIN flats f ON f.id=r.flat_id
   ${where} ORDER BY al.requested_at DESC`, params);
module.exports = { approveAllocation, releaseAllocation, listAllocations };
