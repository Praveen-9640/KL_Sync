const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
});
// Optional single image, max 2 MB, jpeg/png/webp only.
module.exports = multer({
  storage, limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG or WebP images are allowed'))),
}).single('image');
