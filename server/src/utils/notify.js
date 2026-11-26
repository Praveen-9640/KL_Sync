const { query } = require('../config/db');
/** Create an in-app notification. `db` can be a transaction client. */
const notify = (userId, title, message, type = 'info', db = { query }) =>
  db.query('INSERT INTO notifications (user_id,title,message,type) VALUES ($1,$2,$3,$4)', [userId, title, message, type]);
module.exports = { notify };
