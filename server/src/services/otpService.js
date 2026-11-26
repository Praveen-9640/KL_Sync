const crypto = require('crypto');
const { query } = require('../config/db');
const { otpSecret, devOtpConsole } = require('../config/env');
const { HttpError } = require('../utils/httpError');
const { sendOtpEmail, isEmailConfigured } = require('./emailService');
const { sendOtpSms, isSmsConfigured } = require('./smsService');

const OTP_TTL_MIN = 5;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;

const hashOtp = (identifier, code) => crypto.createHmac('sha256', otpSecret).update(`${identifier}:${code}`).digest('hex');
const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

async function sendOtp(channel, identifier) {
  const { rows } = await query('SELECT created_at FROM otp_verifications WHERE identifier=$1 ORDER BY created_at DESC LIMIT 1', [identifier]);
  if (rows[0]) {
    const wait = RESEND_COOLDOWN_SEC - Math.floor((Date.now() - new Date(rows[0].created_at).getTime()) / 1000);
    if (wait > 0) { const e = new HttpError(429, `Please wait ${wait}s before requesting another code`); e.retryAfter = wait; throw e; }
  }
  const configured = channel === 'email' ? isEmailConfigured() : isSmsConfigured();
  const code = generateOtp();
  const devMode = !configured && devOtpConsole;
  if (!configured && !devMode) {
    // Delegate to the provider function so the user gets the specific configuration error.
    await (channel === 'email' ? sendOtpEmail(identifier, code, OTP_TTL_MIN) : sendOtpSms(identifier, code, OTP_TTL_MIN));
  }
  // Invalidate earlier codes, then store the new one (hash only).
  await query('UPDATE otp_verifications SET expires_at = NOW() WHERE identifier=$1 AND verified_at IS NULL AND expires_at > NOW()', [identifier]);
  const ins = await query('INSERT INTO otp_verifications (identifier, otp_hash, expires_at) VALUES ($1,$2, NOW() + ($3 || \' minutes\')::interval) RETURNING id', [identifier, hashOtp(identifier, code), String(OTP_TTL_MIN)]);
  try {
    if (devMode) console.warn(`[DEV ONLY] OTP for ${identifier}: ${code}  (DEV_OTP_CONSOLE=true, no ${channel} provider configured; nothing was actually sent)`);
    else await (channel === 'email' ? sendOtpEmail(identifier, code, OTP_TTL_MIN) : sendOtpSms(identifier, code, OTP_TTL_MIN));
  } catch (err) {
    await query('DELETE FROM otp_verifications WHERE id=$1', [ins.rows[0].id]);
    throw err;
  }
  return { expiresInSeconds: OTP_TTL_MIN * 60, resendAfterSeconds: RESEND_COOLDOWN_SEC, devMode };
}

async function verifyOtp(identifier, code) {
  const { rows } = await query('SELECT * FROM otp_verifications WHERE identifier=$1 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1', [identifier]);
  const rec = rows[0];
  if (!rec) throw new HttpError(400, 'No active code. Please request a new one');
  if (new Date(rec.expires_at) <= new Date()) throw new HttpError(400, 'This code has expired. Please request a new one');
  if (rec.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong attempts. Please request a new code');
  const given = Buffer.from(hashOtp(identifier, String(code || '')));
  const stored = Buffer.from(rec.otp_hash);
  const ok = given.length === stored.length && crypto.timingSafeEqual(given, stored);
  if (!ok) {
    await query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id=$1', [rec.id]);
    throw new HttpError(400, 'Incorrect code');
  }
  // Single-use: atomically mark verified (fails if already used by a concurrent request).
  const upd = await query('UPDATE otp_verifications SET verified_at = NOW() WHERE id=$1 AND verified_at IS NULL RETURNING id', [rec.id]);
  if (!upd.rows[0]) throw new HttpError(400, 'This code was already used');
  return true;
}
module.exports = { sendOtp, verifyOtp, OTP_TTL_MIN };
