const { sms: cfg } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const isConfigured = () => {
  if (cfg.provider === 'twilio') return Boolean(cfg.accountSid && cfg.apiKey && cfg.sender);
  if (cfg.provider === 'msg91') return Boolean(cfg.apiKey && cfg.templateId);
  return false;
};
async function sendOtpSms(phone, code, minutes) {
  if (!isConfigured()) {
    throw new HttpError(503, 'SMS delivery is not configured. Set SMS_PROVIDER (twilio or msg91) and its credentials in server/.env');
  }
  let res;
  try {
    if (cfg.provider === 'twilio') {
      const body = new URLSearchParams({ To: phone, Body: `Your HostelHub OTP is ${code}. Valid for ${minutes} minutes.` });
      body.set(cfg.sender.startsWith('MG') ? 'MessagingServiceSid' : 'From', cfg.sender);
      res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.apiKey}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } else {
      const url = new URL('https://control.msg91.com/api/v5/otp');
      url.search = new URLSearchParams({ template_id: cfg.templateId, mobile: phone.replace('+', ''), authkey: cfg.apiKey, otp: code, otp_expiry: String(minutes) });
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }
  } catch (err) {
    console.error('SMS request failed:', err.message);
    throw new HttpError(502, 'Could not reach the SMS provider.');
  }
  if (!res.ok) {
    console.error('SMS provider rejected request, status', res.status);
    throw new HttpError(502, 'The SMS provider rejected the request. Check credentials and the number.');
  }
  if (cfg.provider === 'msg91') {
    const data = await res.json().catch(() => ({}));
    if (data.type && data.type !== 'success') throw new HttpError(502, 'The SMS provider rejected the request.');
  }
}
module.exports = { sendOtpSms, isSmsConfigured: isConfigured };
