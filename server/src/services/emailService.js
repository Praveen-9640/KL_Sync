const nodemailer = require('nodemailer');
const { email: cfg } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const isConfigured = () => Boolean(cfg.host && cfg.user && cfg.pass);
let transporter;
const getTransporter = () => {
  if (!transporter) transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
  return transporter;
};
async function sendOtpEmail(to, code, minutes) {
  if (!isConfigured()) throw new HttpError(503, 'Email delivery is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER and EMAIL_PASSWORD in server/.env');
  try {
    await getTransporter().sendMail({
      from: cfg.from, to, subject: 'Your HostelHub verification code',
      text: `Your HostelHub verification code is ${code}. It expires in ${minutes} minutes. If you did not request it, ignore this email.`,
      html: `<p>Your HostelHub verification code is:</p><p style="font-size:24px;letter-spacing:4px"><b>${code}</b></p><p>It expires in ${minutes} minutes. If you did not request it, ignore this email.</p>`,
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
    throw new HttpError(502, 'Could not send the email. Check the SMTP settings on the server.');
  }
}
module.exports = { sendOtpEmail, isEmailConfigured: isConfigured };
