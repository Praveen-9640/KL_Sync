import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Field } from '../components/ui.jsx';

const EMPTY = { full_name: '', email: '', password: '', confirm_password: '' };

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [step, setStep] = useState('identify'); // identify | login | register
  const [channel, setChannel] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [regToken, setRegToken] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState(''); 
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { if (user) return <Navigate to={loc.state?.from || '/'} replace />; }, [user]);

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

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
  const setInput = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const checkEmail = async (e) => { e?.preventDefault(); wrap(async () => {
    setErr(''); setInfo(''); setBusy(true);
    if (channel === 'email') {
      const r = await api.post('/auth/check-email', { email: form.email });
      setBusy(false);
      if (r.exists && r.hasPassword) {
        setStep('login');
      } else if (r.exists && !r.hasPassword) {
        setInfo('This account does not have a password set. Set a password to log in, or continue with verification code.');
        setStep('login');
      } else {
        const R = await api.post('/auth/send-otp', { channel, identifier: form.email });
        setIdentifier(R.identifier); setCooldown(R.resendAfterSeconds); setStep('code'); setCode('');
        setInfo(R.devMode ? R.message : `We sent a 6-digit code to ${R.identifier}. It expires in ${Math.round(R.expiresInSeconds / 60)} minutes.`);
      }
    } else {
      const r = await api.post('/auth/send-otp', { channel, identifier: form.email });
      setIdentifier(r.identifier); setCooldown(r.resendAfterSeconds); setStep('code'); setCode('');
      setInfo(r.devMode ? r.message : `We sent a 6-digit code to ${r.identifier}. It expires in ${Math.round(r.expiresInSeconds / 60)} minutes.`);
    }
  }); };
  const doLogin = async (e) => { e?.preventDefault(); wrap(async () => {
    setErr(''); setBusy(true);
    const r = await api.post('/auth/login', { email: form.email, password: form.password });
    setBusy(false);
    login(r.token, r.user); nav(loc.state?.from || '/', { replace: true });
  }); };
  const doRegister = async (e) => { e.preventDefault(); wrap(async () => {
    setErr(''); setBusy(true);
    const r = await api.post('/auth/register-with-password', { 
      full_name: form.full_name, 
      email: form.email, 
      password: form.password, 
      confirm_password: form.confirm_password 
    });
    setBusy(false);
    login(r.token, r.user); nav('/', { replace: true });
  }); };
  const goToIdentify = () => setStep('identify');

  if (user) return <Navigate to={loc.state?.from || '/' } replace />;

  return (
    <div className="auth-wrap">
      <div className={`auth-card ${step === 'register' ? 'wide' : ''}`}>
        <div className="brand"><span className="logo">H</span> HostelHub</div>
        <p className="muted">Hostel life, sorted: rooms, games, marketplace, borrowing and project teams.</p>
        <Alert>{err}</Alert><Alert kind="info">{info}</Alert>

        {step === 'identify' && (
          <form onSubmit={checkEmail}>
            <div className="seg" role="tablist">
              <button type="button" className={channel === 'email' ? 'on' : ''} onClick={() => { setChannel('email'); }}>Email</button>
              <button type="button" className={channel === 'phone' ? 'on' : ''} onClick={() => { setChannel('phone'); }}>Mobile number</button>
            </div>
            <Field label={channel === 'email' ? 'Email address' : 'Mobile number'} hint={channel === 'phone' ? 'Include country code, or we assume the server default (+91).' : undefined}>
              <input type={channel === 'email' ? 'email' : 'tel'} value={form.email} onChange={(e) => channel === 'phone' ? setForm({ ...form, email: e.target.value.replace(/\D/g, '') }) : setInput('email')(e)} required autoFocus placeholder={channel === 'email' ? 'you@college.edu' : '+91 98765 43210'} />
            </Field>
            <button className="btn" disabled={busy}>{busy ? 'Checking…' : channel === 'email' ? 'Check email' : 'Send OTP'}</button>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={doLogin}>
            <Field label="Email address"><input type="email" value={form.email} onChange={setInput('email')} required autoFocus placeholder="you@college.edu" /></Field>
            <Field label="Password"><input type="password" value={form.password} onChange={setInput('password')} required /></Field>
            <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
            <button type="button" className="link" onClick={goToIdentify} style={{ marginLeft: '0.5rem' }}>Back to email</button>
          </form>
        )}

        {step === 'register' && regToken && (
          <form onSubmit={register}>
            <Alert kind="ok">{identifier} is verified. Tell us a bit about yourself to finish.</Alert>
            <div className="grid2">
              <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} /></Field>
              <Field label="Student / College ID"><input value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required maxLength={40} /></Field>
              <Field label="College"><input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} required maxLength={150} /></Field>
              <Field label="Hostel / Residence"><input value={form.hostel_name} onChange={(e) => setForm({ ...form, hostel_name: e.target.value })} required maxLength={120} /></Field>
              <Field label="Block (optional)"><input value={form.hostel_block} onChange={(e) => setForm({ ...form, hostel_block: e.target.value })} maxLength={20} /></Field>
              <Field label="Flat (optional)"><input value={form.flat_number} onChange={(e) => setForm({ ...form, flat_number: e.target.value })} maxLength={20} /></Field>
              <Field label="Room number (optional)"><input value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} maxLength={20} /></Field>
              <Field label="Academic year (optional)"><select value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value }) }><option value="">Select</option>{['1st', '2nd', '3rd', '4th', '5th', 'PG-1', 'PG-2', 'PhD'].map((y) => <option key={y}>{y}</option>)}</select>
              </Field>
              <Field label="Password"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></Field>
              <Field label="Confirm password"><input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required minLength={8} /></Field>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
        )}

        {step === 'register' && !regToken && (
          <form onSubmit={doRegister}>
            <Alert kind="ok">{info}</Alert>
            <div className="grid2">
              <Field label="Full name"><input value={form.full_name} onChange={setInput('full_name')} required maxLength={120} /></Field>
              <Field label="Email address"><input type="email" value={form.email} onChange={setInput('email')} required maxLength={190} /></Field>
              <Field label="Password"><input type="password" value={form.password} onChange={setInput('password')} required minLength={8} /></Field>
              <Field label="Confirm password"><input type="password" value={form.confirm_password} onChange={setInput('confirm_password')} required minLength={8} /></Field>
            </div>
            <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            <button type="button" className="link" onClick={goToIdentify} style={{ marginLeft: '0.5rem' }}>Back to email</button>
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

      </div>
    </div>
  );
}