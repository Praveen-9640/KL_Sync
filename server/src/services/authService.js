const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { query } = require('../config/db');
const { SELF_COLS } = require('../utils/publicUser');

const signSession = (userId) => jwt.sign({ sub: userId, purpose: 'session' }, jwtSecret, { expiresIn: '7d', algorithm: 'HS256' });
const signRegistration = (identifier, channel) => jwt.sign({ identifier, channel, purpose: 'register' }, jwtSecret, { expiresIn: '30m', algorithm: 'HS256' });
const readRegistration = (token) => {
  const p = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  if (p.purpose !== 'register') throw new Error('bad purpose');
  return p;
};
const findUserByIdentifier = async (channel, identifier) => {
  const col = channel === 'email' ? 'email' : 'phone';
  const { rows } = await query(`SELECT ${SELF_COLS} FROM users WHERE ${col}=$1`, [identifier]);
  return rows[0] || null;
};
module.exports = { signSession, signRegistration, readRegistration, findUserByIdentifier };
