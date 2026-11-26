const r = require('express').Router();
const c = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');
r.use(requireAuth);
r.get('/', c.list);
r.post('/read-all', c.markAllRead);
r.post('/:id/read', c.markRead);
module.exports = r;
