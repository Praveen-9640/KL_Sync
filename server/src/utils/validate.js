const { HttpError } = require('./httpError');
const bad = (m) => { throw new HttpError(400, m); };
const empty = (v) => v === undefined || v === null || v === '';
const str = (v, name, { min = 1, max = 500, optional = false } = {}) => {
  if (empty(v)) { if (optional) return null; bad(`${name} is required`); }
  if (typeof v !== 'string') bad(`${name} must be text`);
  const s = v.trim();
  if (s.length < min) { if (optional && !s) return null; bad(`${name} is required`); }
  if (s.length > max) bad(`${name} must be at most ${max} characters`);
  return s;
};
const int = (v, name, { min = -Infinity, max = Infinity, optional = false } = {}) => {
  if (empty(v)) { if (optional) return null; bad(`${name} is required`); }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(`${name} must be a whole number between ${min} and ${max}`);
  return n;
};
const num = (v, name, { min = 0, max = 1e9 } = {}) => {
  const n = Number(v);
  if (empty(v) || Number.isNaN(n) || n < min || n > max) bad(`${name} must be a number between ${min} and ${max}`);
  return n;
};
const oneOf = (v, name, opts, { optional = false } = {}) => {
  if (empty(v) && optional) return null;
  if (!opts.includes(v)) bad(`${name} must be one of: ${opts.join(', ')}`);
  return v;
};
const date = (v, name, { optional = false } = {}) => {
  if (empty(v) && optional) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) bad(`${name} must be a date (YYYY-MM-DD)`);
  return v;
};
const time = (v, name) => {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) bad(`${name} must be a time (HH:MM)`);
  return v;
};
const list = (v, name, { max = 20 } = {}) => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const out = [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
  if (out.length > max) bad(`${name} has too many items (max ${max})`);
  if (out.some((x) => x.length > 60)) bad(`${name} items must be at most 60 characters`);
  return out;
};
const bool = (v) => v === true || v === 'true';
const id = (v, name = 'id') => int(v, name, { min: 1 });
const email = (v) => { const s = str(v, 'Email', { max: 190 }).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) bad('Enter a valid email address'); return s; };
const phone = (v, cc) => {
  let s = str(v, 'Mobile number', { max: 20 }).replace(/[\s()-]/g, '');
  if (!s.startsWith('+')) s = `${cc}${s.replace(/^0+/, '')}`;
  if (!/^\+[1-9]\d{7,14}$/.test(s)) bad('Enter a valid mobile number');
  return s;
};
module.exports = { str, int, num, oneOf, date, time, list, bool, id, email, phone };
