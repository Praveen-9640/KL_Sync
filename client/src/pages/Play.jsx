import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Empty, Field, Modal, PageHead, fmtDate, fmtTime, todayStr } from '../components/ui.jsx';

const GAMES = ['Table Tennis', 'Badminton', 'Chess', 'Carrom', 'Cards', 'Pool', 'Foosball', 'Other'];
export default function Play() {
  const { user } = useAuth();
  const [tab, setTab] = useState('all'); const [game, setGame] = useState('');
  const [items, setItems] = useState([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [create, setCreate] = useState(false); const [detail, setDetail] = useState(null);
  const load = useCallback(() => api.get(`/play${qs({ game, mine: tab === 'mine' })}`).then((r) => setItems(r.requests)).catch((e) => setErr(e.message)), [game, tab]);
  useEffect(() => { load(); }, [load]);
  const act = async (path, msg) => { setErr(''); setOk(''); try { await api.post(path); setOk(msg); load(); setDetail(null); } catch (e) { setErr(e.message); } };
  const view = async (id) => { try { setDetail(await api.get(`/play/${id}`)); } catch (e) { setErr(e.message); } };
  return (
    <>
      <PageHead title="Peer to play" subtitle="Find someone to play indoor games with." action={<button className="btn" onClick={() => setCreate(true)}><Plus size={16} />New request</button>} />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      <div className="tabs"><button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Open requests</button><button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Mine &amp; joined</button></div>
      <div className="toolbar"><select value={game} onChange={(e) => setGame(e.target.value)} aria-label="Game"><option value="">All games</option>{GAMES.map((g) => <option key={g}>{g}</option>)}</select></div>
      {items.length === 0 ? <Empty>No play requests yet. Create one and let others join.</Empty> : (
        <div className="cards">{items.map((p) => { const mineReq = p.user_id === user.id; return (
          <div className="card" key={p.id}>
            <div className="card-top"><h3>{p.game_name}</h3><Badge tone={p.status === 'open' ? 'ok' : p.status === 'full' ? 'warn' : 'bad'}>{p.status === 'open' ? 'Looking for players' : p.status === 'full' ? 'Full' : p.status}</Badge></div>
            <div className="meta"><span>{fmtDate(p.play_date)}, {fmtTime(p.play_time)}</span><span>{p.location}</span></div>
            <div className="meta"><span>{p.joined_count}/{p.players_required} players joined</span><span>by {mineReq ? 'you' : p.creator_name}</span></div>
            {p.description && <p>{p.description}</p>}
            <div className="foot"><button className="btn ghost sm" onClick={() => view(p.id)}>Details</button>
              <span className="actions">
                {!mineReq && !p.joined && p.status === 'open' && <button className="btn sm" onClick={() => act(`/play/${p.id}/join`, 'You joined the game')}>Join</button>}
                {!mineReq && p.joined && <button className="btn danger sm" onClick={() => act(`/play/${p.id}/leave`, 'You left the game')}>Leave</button>}
                {mineReq && ['open', 'full'].includes(p.status) && <button className="btn danger sm" onClick={() => window.confirm('Cancel this request?') && act(`/play/${p.id}/cancel`, 'Request cancelled')}>Cancel</button>}
              </span></div>
          </div>); })}</div>)}
      {create && <CreatePlay onClose={() => setCreate(false)} onDone={() => { setCreate(false); setOk('Request created'); load(); }} />}
      {detail && (
        <Modal title={`${detail.request.game_name} · ${fmtDate(detail.request.play_date)}, ${fmtTime(detail.request.play_time)}`} onClose={() => setDetail(null)}>
          <p className="muted">{detail.request.location} · organised by {detail.request.creator_name}</p>
          {detail.request.description && <p style={{ margin: '8px 0' }}>{detail.request.description}</p>}
          <h3 style={{ margin: '14px 0 6px' }}>Players ({detail.request.joined_count}/{detail.request.players_required})</h3>
          {detail.participants.length === 0 ? <p className="muted">{detail.request.user_id === user.id || detail.request.joined ? 'Nobody has joined yet.' : 'Join to see who else is playing.'}</p> :
            <ul className="list">{detail.participants.map((u) => <li key={u.id}><span>{u.full_name}{u.hostel_block ? ` · Block ${u.hostel_block}` : ''}</span><small>{[u.phone, u.email].filter(Boolean).join(' · ') || 'Contact hidden'}</small></li>)}</ul>}
        </Modal>)}
    </>
  );
}
function CreatePlay({ onClose, onDone }) {
  const [f, setF] = useState({ game_name: 'Table Tennis', play_date: todayStr(), play_time: '18:00', location: 'Indoor Games Room', players_required: 1, description: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.post('/play', f); onDone(); } catch (x) { setErr(x.message); setBusy(false); } };
  return (
    <Modal title="New play request" onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <Field label="Game"><select value={f.game_name} onChange={set('game_name')}>{GAMES.map((g) => <option key={g}>{g}</option>)}</select></Field>
      <div className="grid2"><Field label="Date"><input type="date" min={todayStr()} value={f.play_date} onChange={set('play_date')} required /></Field><Field label="Time"><input type="time" value={f.play_time} onChange={set('play_time')} required /></Field></div>
      <div className="grid2"><Field label="Location"><input value={f.location} onChange={set('location')} required maxLength={120} /></Field><Field label="Players needed" hint="Not counting you"><input type="number" min="1" max="20" value={f.players_required} onChange={set('players_required')} required /></Field></div>
      <Field label="Note (optional)"><textarea value={f.description} onChange={set('description')} maxLength={500} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create request'}</button></form></Modal>
  );
}
