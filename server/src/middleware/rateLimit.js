const rateLimit = require('express-rate-limit');
const mk = (windowMs, max, message) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message } });
module.exports = {
  apiLimiter: mk(60 * 1000, 300, 'Too many requests. Please slow down.'),
  otpSendLimiter: mk(15 * 60 * 1000, 10, 'Too many OTP requests from this network. Try again in 15 minutes.'),
  otpVerifyLimiter: mk(15 * 60 * 1000, 30, 'Too many verification attempts. Try again later.'),
};
