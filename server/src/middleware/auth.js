const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { query } = require('../config/db');
const { HttpError, asyncHandler } = require('../utils/httpError');

const requireAuth = asyncHandler(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in to continue');
  let payload;
  try { payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }); }
  catch { throw new HttpError(401, 'Your session has expired. Please log in again'); }
  if (payload.purpose !== 'session') throw new HttpError(401, 'Invalid session token');
  const { rows } = await query('SELECT id, role FROM users WHERE id=$1', [payload.sub]);
  if (!rows[0]) throw new HttpError(401, 'Account no longer exists');
  req.user = rows[0];
  next();
});
const requireAdmin = (req, _res, next) => (req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Admin access required')));
module.exports = { requireAuth, requireAdmin };
