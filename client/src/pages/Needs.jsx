import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Empty, Field, Modal, PageHead, fmtDate, todayStr } from '../components/ui.jsx';

export default function Needs() {
  const { user } = useAuth();
  const [cats, setCats] = useState([]); const [tab, setTab] = useState('all'); const [f, setF] = useState({ q: '', category: '' });
  const [items, setItems] = useState([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [create, setCreate] = useState(false); const [resp, setResp] = useState(null); const [detail, setDetail] = useState(null);
  useEffect(() => { api.get('/needs/meta').then((r) => setCats(r.categories)).catch(() => {}); }, []);
  const load = useCallback(() => api.get(`/needs${qs({ ...f, mine: tab === 'mine' })}`).then((r) => setItems(r.needs)).catch((e) => setErr(e.message)), [f, tab]);
  useEffect(() => { const t = setTimeout(load, 150); return () => clearTimeout(t); }, [load]);
  const act = async (fn, msg) => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); } catch (e) { setErr(e.message); } };
  const view = async (id) => { try { setDetail(await api.get(`/needs/${id}`)); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHead title="Hostel needs" subtitle="Ask to borrow or buy something, or offer what you have." action={<button className="btn" onClick={() => setCreate(true)}><Plus size={16} />New request</button>} />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      <div className="tabs"><button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Open requests</button><button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My requests</button></div>
      <div className="toolbar"><input className="grow" placeholder="Search items" value={f.q} onChange={set('q')} aria-label="Search" /><select value={f.category} onChange={set('category')} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
      {items.length === 0 ? <Empty>No requests here. Need something? Post a request.</Empty> : (
        <div className="cards">{items.map((n) => { const mine = n.user_id === user.id; return (
          <div className="card" key={n.id}>
            <div className="card-top"><h3>{n.item_name}</h3><Badge tone={n.status === 'open' ? 'ok' : 'neutral'}>{n.status}</Badge></div>
            <div className="meta"><span>Wants to {n.request_type}</span><span>By {fmtDate(n.required_date)}</span>{n.duration && <span>For {n.duration}</span>}{n.location && <span>{n.location}</span>}</div>
            {n.description && <p>{n.description}</p>}
            <div className="meta"><span>{mine ? 'Your request' : `By ${n.requester_name}`}</span><span>{n.response_count} response{n.response_count !== 1 ? 's' : ''}</span></div>
            <div className="foot">
              {mine ? <button className="btn ghost sm" onClick={() => view(n.id)}>See responses</button> : n.my_response ? <Badge tone="warn">You responded ({n.my_response})</Badge> : <span />}
              <span className="actions">
                {!mine && !n.my_response && n.status === 'open' && <button className="btn sm" onClick={() => setResp(n)}>Respond</button>}
                {mine && n.status === 'open' && <button className="btn sm" onClick={() => act(() => api.post(`/needs/${n.id}/fulfill`), 'Marked as fulfilled')}>Mark fulfilled</button>}
                {mine && <button className="btn danger sm" onClick={() => window.confirm('Delete this request?') && act(() => api.del(`/needs/${n.id}`), 'Request deleted')}>Delete</button>}
              </span></div>
          </div>); })}</div>)}
      {create && <CreateNeed cats={cats} onClose={() => setCreate(false)} onDone={() => { setCreate(false); setOk('Request posted'); load(); }} />}
      {resp && <Respond need={resp} onClose={() => setResp(null)} onDone={() => { setResp(null); setOk('Response sent'); load(); }} />}
      {detail && (
        <Modal title={`Responses to "${detail.need.item_name}"`} onClose={() => setDetail(null)}>
          {detail.responses.length === 0 ? <p className="muted">No responses yet.</p> : <ul className="list">{detail.responses.map((r) => (
            <li key={r.id}><span><b>{r.responder.full_name}</b> <Badge>{r.response_type}</Badge>{r.responder.hostel_block && <small> · Block {r.responder.hostel_block}</small>}<br />{r.response_message && <span>"{r.response_message}"</span>}</span>
              <small>{[r.responder.phone, r.responder.email].filter(Boolean).join(' · ') || 'Contact hidden'}</small></li>))}</ul>}
        </Modal>)}
    </>
  );
}
function CreateNeed({ cats, onClose, onDone }) {
  const [f, setF] = useState({ item_name: '', category: 'Appliances', request_type: 'borrow', required_date: todayStr(), duration: '', location: '', description: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.post('/needs', f); onDone(); } catch (x) { setErr(x.message); setBusy(false); } };
  return (
    <Modal title="New item request" onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <Field label="Item needed"><input value={f.item_name} onChange={set('item_name')} required maxLength={120} placeholder="e.g. Iron box" /></Field>
      <div className="grid2"><Field label="Category"><select value={f.category} onChange={set('category')}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="I want to"><select value={f.request_type} onChange={set('request_type')}><option value="borrow">Borrow</option><option value="buy">Buy</option></select></Field>
        <Field label="Needed by"><input type="date" min={todayStr()} value={f.required_date} onChange={set('required_date')} required /></Field>
        <Field label="Duration (if borrowing)"><input value={f.duration} onChange={set('duration')} maxLength={60} placeholder="2 hours" /></Field></div>
      <Field label="Where (block / room)"><input value={f.location} onChange={set('location')} maxLength={120} /></Field>
      <Field label="Details (optional)"><textarea value={f.description} onChange={set('description')} maxLength={500} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post request'}</button></form></Modal>
  );
}
function Respond({ need, onClose, onDone }) {
  const [type, setType] = useState('offer'); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.post(`/needs/${need.id}/respond`, { response_type: type, response_message: msg }); onDone(); } catch (x) { setErr(x.message); setBusy(false); } };
  return (
    <Modal title={`Respond: ${need.item_name}`} onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <Field label="Response"><select value={type} onChange={(e) => setType(e.target.value)}><option value="offer">I have one and can lend or sell it</option><option value="interest">I'm interested, can help find one</option><option value="reaction">Just letting you know I saw this</option></select></Field>
      <Field label="Message (optional)"><textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} placeholder="I have one. You can borrow it." /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send response'}</button></form></Modal>
  );
}
