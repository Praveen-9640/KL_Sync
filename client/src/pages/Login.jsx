import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Field } from '../components/ui.jsx';

const EMPTY = { full_name: '', student_id: '', college: '', hostel_name: '', hostel_block: '', flat_number: '', room_number: '', academic_year: '', department: '' };

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [step, setStep] = useState('identify'); // identify | code | register
  const [channel, setChannel] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [regToken, setRegToken] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState(''); const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  if (user) return <Navigate to={loc.state?.from || '/'} replace />;

  const wrap = async (fn) => { setErr(''); setInfo(''); setBusy(true); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const sendCode = (e) => { e?.preventDefault(); wrap(async () => {
    const r = await api.post('/auth/send-otp', { channel, identifier });
    setIdentifier(r.identifier); setCooldown(r.resendAfterSeconds); setStep('code'); setCode('');
    setInfo(r.devMode ? r.message : `We sent a 6-digit code to ${r.identifier}. It expires in ${Math.round(r.expiresInSeconds / 60)} minutes.`);
  }); };
  const verify = (e) => { e.preventDefault(); wrap(async () => {
    const r = await api.post('/auth/verify-otp', { channel, identifier, code });
    if (r.isNewUser) { setRegToken(r.registrationToken); setStep('register'); }
    else { login(r.token, r.user); nav(loc.state?.from || '/', { replace: true }); }
  }); };
  const register = (e) => { e.preventDefault(); wrap(async () => {
    const r = await api.post('/auth/register', { registrationToken: regToken, ...form });
    login(r.token, r.user); nav('/', { replace: true });
  }); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-wrap">
      <div className={`auth-card ${step === 'register' ? 'wide' : ''}`}>
        <div className="brand"><span className="logo">H</span> HostelHub</div>
        <p className="muted">Hostel life, sorted: rooms, games, marketplace, borrowing and project teams.</p>
        <Alert>{err}</Alert><Alert kind="info">{info}</Alert>

        {step === 'identify' && (
          <form onSubmit={sendCode}>
            <div className="seg" role="tablist">
              <button type="button" className={channel === 'email' ? 'on' : ''} onClick={() => { setChannel('email'); setIdentifier(''); }}>Email</button>
              <button type="button" className={channel === 'phone' ? 'on' : ''} onClick={() => { setChannel('phone'); setIdentifier(''); }}>Mobile number</button>
            </div>
            <Field label={channel === 'email' ? 'Email address' : 'Mobile number'} hint={channel === 'phone' ? 'Include country code, or we assume the server default (+91).' : undefined}>
              <input type={channel === 'email' ? 'email' : 'tel'} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus placeholder={channel === 'email' ? 'you@college.edu' : '+91 98765 43210'} />
            </Field>
            <button className="btn" disabled={busy}>{busy ? 'Sending…' : channel === 'email' ? 'Send verification code' : 'Send OTP'}</button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify}>
            <Field label="Enter the 6-digit code"><input className="otp-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required autoFocus autoComplete="one-time-code" /></Field>
            <div className="actions">
              <button className="btn" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
              <button type="button" className="btn ghost" disabled={busy || cooldown > 0} onClick={sendCode}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
              <button type="button" className="link" onClick={() => { setStep('identify'); setErr(''); setInfo(''); }}>Change {channel === 'email' ? 'email' : 'number'}</button>
            </div>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={register}>
            <Alert kind="ok">{identifier} is verified. Tell us a bit about yourself to finish.</Alert>
            <div className="grid2">
              <Field label="Full name"><input value={form.full_name} onChange={set('full_name')} required maxLength={120} /></Field>
              <Field label="Student / College ID"><input value={form.student_id} onChange={set('student_id')} required maxLength={40} /></Field>
              <Field label="College"><input value={form.college} onChange={set('college')} required maxLength={150} /></Field>
              <Field label="Hostel / Residence"><input value={form.hostel_name} onChange={set('hostel_name')} required maxLength={120} /></Field>
              <Field label="Block (optional)"><input value={form.hostel_block} onChange={set('hostel_block')} maxLength={20} /></Field>
              <Field label="Flat (optional)"><input value={form.flat_number} onChange={set('flat_number')} maxLength={20} /></Field>
              <Field label="Room number (optional)"><input value={form.room_number} onChange={set('room_number')} maxLength={20} /></Field>
              <Field label="Academic year (optional)">
                <select value={form.academic_year} onChange={set('academic_year')}><option value="">Select</option>{['1st', '2nd', '3rd', '4th', '5th', 'PG-1', 'PG-2', 'PhD'].map((y) => <option key={y}>{y}</option>)}</select>
              </Field>
            </div>
            <Field label="Course / Department (optional)"><input value={form.department} onChange={set('department')} maxLength={120} /></Field>
            <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
