import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api, qs } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Empty, Field, Modal, PageHead, fmtDate } from '../components/ui.jsx';

export default function Market() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const [meta, setMeta] = useState({ categories: [], conditions: [] });
  const [tab, setTab] = useState('all');
  const [f, setF] = useState({ q: sp.get('q') || '', category: '', sort: 'new' });
  const [items, setItems] = useState([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [edit, setEdit] = useState(null); const [view, setView] = useState(null);
  useEffect(() => { api.get('/market/meta').then(setMeta).catch(() => {}); }, []);
  useEffect(() => { setF((x) => ({ ...x, q: sp.get('q') || '' })); }, [sp]);
  const load = useCallback(() => { const t = setTimeout(() => api.get(`/market${qs({ ...f, mine: tab === 'mine' })}`).then((r) => setItems(r.items)).catch((e) => setErr(e.message)), 150); return () => clearTimeout(t); }, [f, tab]);
  useEffect(() => load(), [load]);
  const reload = () => api.get(`/market${qs({ ...f, mine: tab === 'mine' })}`).then((r) => setItems(r.items));
  const act = async (fn, msg) => { setErr(''); setOk(''); try { await fn(); setOk(msg); setView(null); reload(); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <PageHead title="Hostel marketplace" subtitle="Buy and sell used hostel essentials." action={<button className="btn" onClick={() => setEdit({})}><Plus size={16} />Sell an item</button>} />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      <div className="tabs"><button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Browse</button><button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My listings</button></div>
      <div className="toolbar">
        <input className="grow" placeholder="Search items" value={f.q} onChange={set('q')} aria-label="Search items" />
        <select value={f.category} onChange={set('category')} aria-label="Category"><option value="">All categories</option>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={f.sort} onChange={set('sort')} aria-label="Sort"><option value="new">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
      </div>
      {items.length === 0 ? <Empty>{tab === 'mine' ? 'You have not listed anything yet.' : 'No items found.'}</Empty> : (
        <div className="cards">{items.map((m) => (
          <div className="card" key={m.id}>
            {m.image_url && <img className="thumb" src={m.image_url} alt={m.title} loading="lazy" />}
            <div className="card-top"><h3>{m.title}</h3>{m.status !== 'available' && <Badge tone="bad">{m.status}</Badge>}</div>
            <div className="price">₹{m.price.toLocaleString('en-IN')}</div>
            <div className="meta"><span>{m.category}</span><span>{m.condition}</span><span>Pickup: {m.pickup_location}</span></div>
            <div className="meta"><span>Seller: {m.seller_id === user.id ? 'you' : m.seller_name}</span><span>{fmtDate(m.created_at)}</span></div>
            <div className="foot"><button className="btn ghost sm" onClick={() => setView(m)}>Details</button>
              {m.seller_id === user.id && m.status === 'available' && <span className="actions"><button className="btn ghost sm" onClick={() => setEdit(m)}>Edit</button><button className="btn sm" onClick={() => act(() => api.post(`/market/${m.id}/sold`), 'Marked as sold')}>Mark sold</button></span>}
              {m.seller_id === user.id && <button className="btn danger sm" onClick={() => window.confirm('Delete this listing?') && act(() => api.del(`/market/${m.id}`), 'Listing deleted')}>Delete</button>}
            </div>
          </div>))}</div>)}
      {edit && <ItemForm meta={meta} item={edit} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); setOk(m); reload(); }} />}
      {view && <Detail m={view} mine={view.seller_id === user.id} onClose={() => setView(null)} onInterest={(msg) => act(() => api.post(`/market/${view.id}/interest`, { message: msg }), 'The seller has been notified')} />}
    </>
  );
}
function Detail({ m, mine, onClose, onInterest }) {
  const [msg, setMsg] = useState(''); const [rep, setRep] = useState(false); const [reason, setReason] = useState(''); const [note, setNote] = useState('');
  const report = async () => { try { await api.post('/reports', { target_type: 'marketplace', target_id: m.id, reason }); setNote('Report sent to hostel management'); setRep(false); } catch (e) { setNote(e.message); } };
  return (
    <Modal title={m.title} onClose={onClose}>
      {m.image_url && <img className="thumb" src={m.image_url} alt={m.title} style={{ height: 220 }} />}
      <div className="price">₹{m.price.toLocaleString('en-IN')}</div>
      <p style={{ margin: '8px 0' }}>{m.description || 'No description provided.'}</p>
      <dl className="kv"><dt>Category</dt><dd>{m.category}</dd><dt>Condition</dt><dd>{m.condition}</dd><dt>Pickup</dt><dd>{m.pickup_location}</dd><dt>Seller</dt><dd>{m.seller_name}</dd>
        {(m.seller_phone || m.seller_email) && <><dt>Contact</dt><dd>{[m.seller_phone, m.seller_email].filter(Boolean).join(' · ')}</dd></>}</dl>
      <Alert kind="info">{note}</Alert>
      {!mine && m.status === 'available' && <div style={{ marginTop: 14 }}>
        <Field label="Message to seller (optional)"><input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} placeholder="Is this still available?" /></Field>
        <div className="actions"><button className="btn" onClick={() => onInterest(msg)}>I'm interested</button><button className="btn ghost" onClick={() => setRep(!rep)}>Report</button></div>
        {rep && <div style={{ marginTop: 10 }}><Field label="What is wrong with this listing?"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field><button className="btn danger sm" disabled={!reason.trim()} onClick={report}>Send report</button></div>}
      </div>}
    </Modal>
  );
}
function ItemForm({ meta, item, onClose, onDone }) {
  const editing = Boolean(item.id);
  const [f, setF] = useState({ title: item.title || '', category: item.category || 'Other', description: item.description || '', price: item.price ?? '', condition: item.condition || 'Good', pickup_location: item.pickup_location || '' });
  const [file, setFile] = useState(null); const [rm, setRm] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append('image', file); if (rm) fd.append('remove_image', 'true');
    try { if (editing) await api.put(`/market/${item.id}`, fd); else await api.post('/market', fd); onDone(editing ? 'Listing updated' : 'Listing published'); } catch (x) { setErr(x.message); setBusy(false); }
  };
  const pick = (e) => { const fl = e.target.files[0]; if (fl && fl.size > 2 * 1024 * 1024) { setErr('Image must be under 2 MB'); e.target.value = ''; return; } setErr(''); setFile(fl || null); };
  return (
    <Modal title={editing ? 'Edit listing' : 'New listing'} onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <Field label="Product name"><input value={f.title} onChange={set('title')} required maxLength={140} /></Field>
      <div className="grid2"><Field label="Category"><select value={f.category} onChange={set('category')}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Condition"><select value={f.condition} onChange={set('condition')}>{meta.conditions.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Price (₹)"><input type="number" min="0" step="1" value={f.price} onChange={set('price')} required /></Field>
        <Field label="Pickup location"><input value={f.pickup_location} onChange={set('pickup_location')} required maxLength={120} /></Field></div>
      <Field label="Description"><textarea value={f.description} onChange={set('description')} maxLength={1000} /></Field>
      <Field label="Photo (optional)" hint="JPG, PNG or WebP, up to 2 MB."><input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} /></Field>
      {editing && item.image_url && <label className="check"><input type="checkbox" checked={rm} onChange={(e) => setRm(e.target.checked)} />Remove current photo</label>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}</button></form></Modal>
  );
}
