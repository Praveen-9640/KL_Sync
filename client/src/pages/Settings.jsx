import { useState } from 'react';
import { api } from '../services/api.js';
import { applyTheme, useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, PageHead } from '../components/ui.jsx';

const THEMES = [
  { id: 'classic', name: 'Classic', desc: 'Warm neutral with navy and tan.', sw: ['#F5F5F2', '#263A4A', '#B89B72'] },
  { id: 'decent', name: 'Decent', desc: 'Cool grey with slate tones.', sw: ['#F2F4F6', '#334155', '#8A9A8B'] },
  { id: 'simple', name: 'Simple', desc: 'Near-white with charcoal.', sw: ['#FAFAFA', '#2B2B2B', '#6B7F99'] },
  { id: 'normal', name: 'Normal', desc: 'Soft stone with teal-grey.', sw: ['#F4F3F0', '#3B4F5C', '#A9886A'] },
];
export default function Settings() {
  const { user, setUser } = useAuth(); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const pick = async (t) => {
    setErr(''); setOk(''); applyTheme(t);
    try { await api.put('/profile/theme', { theme: t }); setUser({ ...user, theme: t }); setOk('Theme saved'); }
    catch (e) { setErr(`Theme applied here but could not be saved to your profile: ${e.message}`); }
  };
  return (
    <>
      <PageHead title="Settings" />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      <div className="card"><h2 style={{ marginBottom: 12 }}>Theme</h2>
        <div className="theme-grid">{THEMES.map((t) => (
          <button key={t.id} className={`theme-opt ${user.theme === t.id ? 'on' : ''}`} onClick={() => pick(t.id)} aria-pressed={user.theme === t.id}>
            <div className="swatches">{t.sw.map((c) => <i key={c} style={{ background: c }} />)}</div><b>{t.name}</b><br /><small>{t.desc}</small></button>))}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h2>Custom background <Badge>Coming soon</Badge></h2>
        <p className="muted" style={{ marginTop: 6 }}>Choosing your own background will arrive in a future version.</p>
        <button className="btn ghost" disabled style={{ marginTop: 10 }}>Choose background</button></div>
    </>
  );
}
