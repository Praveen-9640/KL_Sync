const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const bcrypt = require('bcrypt');
const { sms, email: _e } = require('../config/env');
const otp = require('../services/otpService');
const auth = require('../services/authService');
const { query } = require('../config/db');
const { SELF_COLS } = require('../utils/publicUser');
const SALT_ROUNDS = 12;

const normalise = (channel, raw) => {
  v.oneOf(channel, 'channel', ['email', 'phone']);
  return channel === 'email' ? v.email(raw) : v.phone(raw, sms.cc);
};

const validateLoginInput = (email, password) => {
  v.str(email, 'Email', { max: 190 });
  const normalizedEmail = v.email(email); // validates format and lowercases
  v.str(password, 'Password', { min: 1 });
  return normalizedEmail;
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
  const full_name = v.str(b.full_name, 'Full name', { max: 120 });
  const student_id = v.str(b.student_id, 'Student ID', { max: 40 });
  const college = v.str(b.college, 'College', { max: 150 });
  const hostel_name = v.str(b.hostel_name, 'Hostel', { max: 120 });
  const hostel_block = v.str(b.hostel_block, 'Block', { max: 20, optional: true });
  const flat_number = v.str(b.flat_number, 'Flat', { max: 20, optional: true });
  const room_number = v.str(b.room_number, 'Room number', { max: 20, optional: true });
  const academic_year = v.str(b.academic_year, 'Academic year', { max: 20, optional: true });
  const password = b.password ? v.str(b.password, 'Password', { min: 8 }) : null;
  const confirm_password = b.confirm_password ? v.str(b.confirm_password, 'Confirm password', { min: 8 }) : null;

  if (password && confirm_password && password !== confirm_password) {
    throw new HttpError(400, 'Password and confirm password do not match');
  }

  const email = reg.channel === 'email' ? reg.identifier : null;
  const phone = reg.channel === 'phone' ? reg.identifier : null;

  let password_hash = null;
  if (password) {
    password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const { rows } = await query(
    `INSERT INTO users (full_name,student_id,email,phone,college,department,academic_year,hostel_name,hostel_block,flat_number,room_number,password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${SELF_COLS}`,
    [full_name, student_id, email, phone, college, null, academic_year, hostel_name, hostel_block, flat_number, room_number, password_hash]
  ).catch((e) => { if (e.code === '23505') throw new HttpError(409, 'An account with this Student ID or contact already exists'); throw e; });
  res.status(201).json({ token: auth.signSession(rows[0].id), user: rows[0] });
});

/**
 * Check whether an email is registered and whether the user has a password hash.
 * Returns:
 *   { exists: true, hasPassword: true }   – user exists and can log in with password
 *   { exists: true, hasPassword: false }  – user exists but OTP-only (no password set)
 *   { exists: false }                      – user not registered (no info revealed)
 */
exports.checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const normalized = v.email(email); // validates format and lowercases
  const { rows } = await query(
    `SELECT password_hash FROM users WHERE email=$1`,
    [normalized]
  );
  if (rows.length === 0) {
    res.json({ exists: false });
  } else {
    res.json({ exists: true, hasPassword: !!rows[0].password_hash });
  }
});

/**
 * Login with email and password.
 * - Checks if the email is registered in the database.
 * - If registered, verifies the password securely using bcrypt.
 * - On success, generates a JWT session token.
 * - On failure, returns a friendly error message without exposing sensitive data.
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = validateLoginInput(email, password);

  // Check whether the email is registered in the database.
  const { rows: existingUsers } = await query(
    `SELECT id, full_name, email, password_hash, role FROM users WHERE email=$1`,
    [normalizedEmail]
  );
  const user = existingUsers[0];

  if (!user) {
    // Email not registered – do not expose whether it exists or not via a generic message.
    throw new HttpError(401, 'Invalid email or password');
  }

  // If user has no password hash, provide a path to set a password instead of login.
  if (!user.password_hash) {
    throw new HttpError(401, 'This account does not have a password set. Use the register-with-password flow to set a password, or continue with OTP verification.');
  }

  // Verify the password securely against the stored hash.
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new HttpError(401, 'Invalid email or password');
  }

  // Generate the token only after successful password verification.
  const token = auth.signSession(user.id);
  // Return user data without the password hash.
const { password_hash: _ph, ...userData } = user;
  res.json({ token, user: userData });
});

exports.me = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${SELF_COLS} FROM users WHERE id=$1`, [req.user.id]);
  res.json({ user: rows[0] });
});

/**
 * Helper: hash a password and update the user's password_hash in the DB.
 * Used during registration (after OTP verification) and on-profile-update.
 */
async function hashAndSavePassword(email, plainPassword) {
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(plainPassword, saltRounds);
  await query(
    `UPDATE users SET password_hash=$1 WHERE email=$2`,
    [passwordHash, email]
  );
  return passwordHash;
}

/**
 * Registration flow for password-based accounts (Phase 1: new users, no OTP required).
 * Also supports existing OTP users completing profile after verification.
 * - If registrationToken is provided: completes profile after OTP verification.
 * - If registrationToken is absent: new user registers with email + password directly.
 */
exports.registerWithPassword = asyncHandler(async (req, res) => {
  const { registrationToken } = req.body;

  let reg;
  if (registrationToken) {
    // OTP completion flow: verify the registration token from verify-otp
    try { reg = auth.readRegistration(registrationToken); }
    catch { throw new HttpError(401, 'Verification expired. Please verify your contact again'); }
  }

  const b = req.body;
  const full_name = v.str(b.full_name, 'Full name', { max: 120 });
  const student_id = v.str(b.student_id, 'Student ID', { max: 40, optional: true });
  const college = v.str(b.college, 'College', { max: 150, optional: true });
  const hostel_name = v.str(b.hostel_name, 'Hostel', { max: 120, optional: true });
  const hostel_block = v.str(b.hostel_block, 'Block', { max: 20, optional: true });
  const flat_number = v.str(b.flat_number, 'Flat', { max: 20, optional: true });
  const room_number = v.str(b.room_number, 'Room number', { max: 20, optional: true });
  const academic_year = v.str(b.academic_year, 'Academic year', { max: 20, optional: true });
  const department = v.str(b.department, 'Department', { max: 120, optional: true });
  const password = v.str(b.password, 'Password', { min: 8 });
  const confirmPassword = v.str(b.confirm_password, 'Confirm password', { min: 8 });

  if (password !== confirmPassword) {
    throw new HttpError(400, 'Password and confirm password do not match');
  }

  const normalizedEmail = v.email(b.email); // validates format and lowercases

  // Check whether the email is already registered.
  let existingUser;
  try { existingUser = await auth.findUserByEmail(normalizedEmail); }
  catch { throw new HttpError(500, 'Database error'); }

  // If user exists and already has a password, require login instead.
  if (existingUser && existingUser.password_hash) {
    throw new HttpError(409, 'An account with this email already exists. Please log in instead.');
  }

  // If user exists but has NO password (OTP-only), allow setting a password.
  // This completes password registration for an existing OTP account.

  // Determine the user's channel from the registration token (if provided),
  // otherwise default to email for new registration.
  const channel = reg && reg.channel ? reg.channel : 'email';
  const email = channel === 'email' ? normalizedEmail : null;
  const phone = channel === 'phone' ? v.phone(b.phone, sms.cc) : null;

  // Hash the password using bcrypt before storing.
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  if (existingUser) {
    // Existing OTP user: update their password_hash
    await query(
      `UPDATE users SET password_hash=$1 WHERE email=$2`,
      [passwordHash, normalizedEmail]
    );
    const { rows: updatedUser } = await query(
      `SELECT ${SELF_COLS} FROM users WHERE email=$1`,
      [normalizedEmail]
    );
    const userData = updatedUser[0];
    const { password_hash: _ph, ...cleanUser } = userData;
    const token = auth.signSession(userData.id);
    res.json({ token, user: cleanUser });
  } else {
    // New user: insert into users table with password_hash
    const { rows } = await query(
      `INSERT INTO users (full_name,student_id,email,phone,college,department,academic_year,hostel_name,hostel_block,flat_number,room_number, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${SELF_COLS}`,
      [full_name, student_id, email, phone, college, department, academic_year, hostel_name, hostel_block, flat_number, room_number, passwordHash]
    ).catch((e) => { if (e.code === '23505') throw new HttpError(409, 'An account with this Student ID or contact already exists'); throw e; });
    const token = auth.signSession(rows[0].id);
    const { password_hash: _ph, ...userData } = rows[0];
    res.json({ token, user: userData });
  }
});

/**
 * Login with email and password (legacy/alias for exports.login).
 * Kept for explicit routing clarity.
 */
exports.doLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Reuse the core login logic; this mirrors exports.login.
  const normalizedEmail = validateLoginInput(email, password);

  const { rows: existingUsers } = await query(
    `SELECT id, full_name, email, password_hash, role FROM users WHERE email=$1`,
    [normalizedEmail]
  );
  const user = existingUsers[0];

  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = auth.signSession(user.id);
  const { password_hash: _ph, ...userData } = user;
  res.json({ token, user: userData });
});

// Sessions are stateless JWTs; the client discards the token. Endpoint exists for a clean API contract.
exports.logout = (_req, res) => res.json({ message: 'Logged out' });
