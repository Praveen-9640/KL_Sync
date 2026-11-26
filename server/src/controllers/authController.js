const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { sms, email: _e } = require('../config/env');
const otp = require('../services/otpService');
const auth = require('../services/authService');
const { query } = require('../config/db');
const { SELF_COLS } = require('../utils/publicUser');

const normalise = (channel, raw) => {
  v.oneOf(channel, 'channel', ['email', 'phone']);
  return channel === 'email' ? v.email(raw) : v.phone(raw, sms.cc);
};

exports.sendOtp = asyncHandler(async (req, res) => {
  const { channel, identifier } = req.body;
  const id = normalise(channel, identifier);
  try {
    const out = await otp.sendOtp(channel, id);
    res.json({ message: out.devMode ? 'Development mode: code printed to the server console (not sent)' : 'Code sent', identifier: id, ...out });
  } catch (e) {
    if (e.retryAfter) res.set('Retry-After', String(e.retryAfter));
    throw e;
  }
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { channel, identifier, code } = req.body;
  const id = normalise(channel, identifier);
  v.str(code, 'Code', { min: 6, max: 6 });
  await otp.verifyOtp(id, code);
  const user = await auth.findUserByIdentifier(channel, id);
  if (user) return res.json({ isNewUser: false, token: auth.signSession(user.id), user });
  res.json({ isNewUser: true, registrationToken: auth.signRegistration(id, channel) });
});

exports.register = asyncHandler(async (req, res) => {
  let reg;
  try { reg = auth.readRegistration(req.body.registrationToken); }
  catch { throw new HttpError(401, 'Verification expired. Please verify your contact again'); }
  const b = req.body;
  const data = {
    full_name: v.str(b.full_name, 'Full name', { max: 120 }),
    student_id: v.str(b.student_id, 'Student ID', { max: 40 }),
    college: v.str(b.college, 'College', { max: 150 }),
    hostel_name: v.str(b.hostel_name, 'Hostel', { max: 120 }),
    hostel_block: v.str(b.hostel_block, 'Block', { max: 20, optional: true }),
    flat_number: v.str(b.flat_number, 'Flat', { max: 20, optional: true }),
    room_number: v.str(b.room_number, 'Room number', { max: 20, optional: true }),
    academic_year: v.str(b.academic_year, 'Academic year', { max: 20, optional: true }),
    department: v.str(b.department, 'Department', { max: 120, optional: true }),
  };
  // The other contact (optional) is stored unverified-free: only the verified one is trusted for login.
  const email = reg.channel === 'email' ? reg.identifier : null;
  const phone = reg.channel === 'phone' ? reg.identifier : null;
  const { rows } = await query(
    `INSERT INTO users (full_name,student_id,email,phone,college,department,academic_year,hostel_name,hostel_block,flat_number,room_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${SELF_COLS}`,
    [data.full_name, data.student_id, email, phone, data.college, data.department, data.academic_year, data.hostel_name, data.hostel_block, data.flat_number, data.room_number]
  ).catch((e) => { if (e.code === '23505') throw new HttpError(409, 'An account with this Student ID or contact already exists'); throw e; });
  res.status(201).json({ token: auth.signSession(rows[0].id), user: rows[0] });
});

exports.me = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${SELF_COLS} FROM users WHERE id=$1`, [req.user.id]);
  res.json({ user: rows[0] });
});

// Sessions are stateless JWTs; the client discards the token. Endpoint exists for a clean API contract.
exports.logout = (_req, res) => res.json({ message: 'Logged out' });
