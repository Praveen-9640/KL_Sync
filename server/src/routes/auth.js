const r = require('express').Router();
const c = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit');

// OTP routes (preserved unchanged)
r.post('/send-otp',   otpSendLimiter, c.sendOtp);
r.post('/verify-otp', otpVerifyLimiter, c.verifyOtp);

// Password-based authentication routes
r.post('/login', c.login);                      // email + password → JWT session
r.post('/check-email', c.checkEmail);           // check if email is registered & has password

// OTP-based registration (preserved from original flow)
r.post('/register', otpVerifyLimiter, c.register); // after OTP verify, complete profile (no password)

// Password registration after OTP verification (new flow)
r.post('/register-with-password', c.registerWithPassword); // complete profile + set password
r.get('/me', requireAuth, c.me);
r.post('/logout', requireAuth, c.logout);
module.exports = r;