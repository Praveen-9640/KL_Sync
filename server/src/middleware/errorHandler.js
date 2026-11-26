const { isProd } = require('../config/env');
const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'That entry already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
  if (err.code === '23514' || err.code === '22P02') return res.status(400).json({ error: 'Invalid value supplied' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && isProd ? 'Something went wrong on our side' : err.message });
};
module.exports = { notFound, errorHandler };
