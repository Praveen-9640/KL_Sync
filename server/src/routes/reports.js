const r = require('express').Router();
const { asyncHandler } = require('../utils/httpError');
const v = require('../utils/validate');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
r.use(requireAuth);
r.post('/', asyncHandler(async (req, res) => {
  const type = v.oneOf(req.body.target_type, 'Type', ['marketplace', 'play', 'need', 'project', 'user']);
  await query('INSERT INTO reports (reporter_id,target_type,target_id,reason) VALUES ($1,$2,$3,$4)', [req.user.id, type, v.id(req.body.target_id, 'Target'), v.str(req.body.reason, 'Reason', { max: 500 })]);
  res.status(201).json({ message: 'Report sent to hostel management' });
}));
module.exports = r;
