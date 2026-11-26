require('dotenv').config();
const e = process.env;
const env = {
  nodeEnv: e.NODE_ENV || 'development',
  isProd: e.NODE_ENV === 'production',
  port: Number(e.PORT) || 5000,
  clientUrl: e.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: e.DATABASE_URL,
  jwtSecret: e.JWT_SECRET,
  otpSecret: e.OTP_SECRET,
  semester: e.CURRENT_SEMESTER || 'Spring 2027',
  email: { host: e.EMAIL_HOST, port: Number(e.EMAIL_PORT) || 587, secure: e.EMAIL_SECURE === 'true', user: e.EMAIL_USER, pass: e.EMAIL_PASSWORD, from: e.EMAIL_FROM || e.EMAIL_USER },
  sms: { provider: (e.SMS_PROVIDER || '').toLowerCase(), apiKey: e.SMS_API_KEY, sender: e.SMS_SENDER_ID, accountSid: e.SMS_ACCOUNT_SID, templateId: e.SMS_TEMPLATE_ID, cc: e.DEFAULT_COUNTRY_CODE || '+91' },
  devOtpConsole: e.DEV_OTP_CONSOLE === 'true' && e.NODE_ENV !== 'production',
};
function validateEnv() {
  const missing = ['DATABASE_URL', 'JWT_SECRET', 'OTP_SECRET'].filter((k) => !e[k]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
    process.exit(1);
  }
  if (e.JWT_SECRET.length < 32 || e.OTP_SECRET.length < 32) {
    console.error('JWT_SECRET and OTP_SECRET must be at least 32 characters.');
    process.exit(1);
  }
}
module.exports = { ...env, validateEnv };
