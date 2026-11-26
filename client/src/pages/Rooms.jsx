import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../services/api.js';
import { Alert, Badge, Empty, Modal, PageHead, csv } from '../components/ui.jsx';

const DIRS = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
export default function Rooms() {
  const [f, setF] = useState({ q: '', block: '', floor: '', balcony_direction: '', facility: '', only_available: false });
  const [flats, setFlats] = useState([]); const [sem, setSem] = useState('');
  const [mine, setMine] = useState([]); const [sel, setSel] = useState(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const load = useCallback(() => {
    api.get(`/rooms/flats${qs(f)}`).then((r) => { setFlats(r.flats); setSem(r.semester); }).catch((e) => setErr(e.message));
    api.get('/rooms/my/allocations').then((r) => setMine(r.allocations)).catch(() => {});
  }, [f]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  const open = async (id) => { setErr(''); setOk(''); try { setSel(await api.get(`/rooms/flats/${id}`)); } catch (e) { setErr(e.message); } };
  const request = async (roomId) => { setErr(''); setOk(''); try { const r = await api.post(`/rooms/${roomId}/request`); setOk(r.message); setSel(null); load(); } catch (e) { setErr(e.message); setSel(null); } };
  const cancel = async (id) => { setErr(''); try { await api.del(`/rooms/allocations/${id}`); setOk('Request cancelled'); load(); } catch (e) { setErr(e.message); } };
  const blocks = [...new Set(flats.map((x) => x.block_name))];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const active = mine.filter((m) => ['requested', 'allocated'].includes(m.allocation_status));
  return (
    <>
      <PageHead title="Room selection" subtitle={sem ? `Semester: ${sem}. Room details are managed by hostel management.` : ''} />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      {mine.length > 0 && <div className="card" style={{ marginBottom: 16 }}><h2>My room requests</h2>
        <ul className="list">{mine.map((m) => (<li key={m.id}><span>Flat {m.flat_number}, room {m.room_number} ({m.semester}) <Badge tone={m.allocation_status === 'allocated' ? 'ok' : m.allocation_status === 'requested' ? 'warn' : 'bad'}>{m.allocation_status}</Badge></span>
          {['requested', 'allocated'].includes(m.allocation_status) && <button className="btn danger sm" onClick={() => cancel(m.id)}>{m.allocation_status === 'allocated' ? 'Release room' : 'Cancel request'}</button>}</li>))}</ul></div>}
      <div className="toolbar">
        <input className="grow" placeholder="Search flat or room number" value={f.q} onChange={set('q')} aria-label="Search flats" />
        <select value={f.block} onChange={set('block')} aria-label="Block"><option value="">All blocks</option>{(blocks.length ? blocks : ['A', 'B']).map((b) => <option key={b}>{b}</option>)}</select>
        <select value={f.floor} onChange={set('floor')} aria-label="Floor"><option value="">All floors</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Floor {n}</option>)}</select>
        <select value={f.balcony_direction} onChange={set('balcony_direction')} aria-label="Balcony direction"><option value="">Any balcony</option>{DIRS.map((d) => <option key={d}>{d}</option>)}</select>
        <select value={f.facility} onChange={set('facility')} aria-label="Facility"><option value="">Any facility</option>{['Wi-Fi', 'Study table', 'Wardrobe', 'Geyser', 'Fridge', 'Ceiling fan'].map((d) => <option key={d}>{d}</option>)}</select>
        <label className="check"><input type="checkbox" checked={f.only_available} onChange={set('only_available')} />Free beds only</label>
      </div>
      {flats.length === 0 ? <Empty>No flats match these filters.</Empty> : (
        <div className="cards">{flats.map((fl) => (
          <div className="card" key={fl.id}>
            <div className="card-top"><h3>Flat {fl.flat_number}</h3><Badge tone={fl.available_beds > 0 ? 'ok' : 'bad'}>{fl.available_beds > 0 ? `${fl.available_beds} bed${fl.available_beds > 1 ? 's' : ''} free` : 'Full'}</Badge></div>
            <div className="meta"><span>Block {fl.block_name}</span><span>Floor {fl.floor_number}</span><span>{fl.room_count} room{fl.room_count !== 1 ? 's' : ''}</span></div>
            <div className="meta"><span>Balcony: {fl.balcony_available ? fl.balcony_direction || 'Yes' : 'No'}</span><span>Kitchen: {fl.kitchen}</span><span>Bathroom: {fl.bathroom_type}</span></div>
            <div className="chips">{fl.rooms.map((r) => <span className="chip" key={r.id}>{r.room_number}: {r.available_beds}/{r.capacity}</span>)}</div>
            <div className="foot"><small>{csv(fl.facilities)}</small><button className="btn ghost sm" onClick={() => open(fl.id)}>View rooms</button></div>
          </div>))}</div>)}
      {sel && (
        <Modal title={`Flat ${sel.flat.flat_number} · Block ${sel.flat.block_name}`} wide onClose={() => setSel(null)}>
          <dl className="kv" style={{ marginBottom: 14 }}>
            <dt>Floor</dt><dd>{sel.flat.floor_number}</dd><dt>Balcony</dt><dd>{sel.flat.balcony_available ? `Yes, facing ${sel.flat.balcony_direction || 'n/a'}` : 'No'}</dd>
            <dt>Kitchen</dt><dd>{sel.flat.kitchen}</dd><dt>Bathroom</dt><dd>{sel.flat.bathroom_type}{sel.flat.bathroom_details ? ` – ${sel.flat.bathroom_details}` : ''}</dd>
            <dt>Facilities</dt><dd>{csv(sel.flat.facilities) || '-'}</dd>{sel.flat.description && <><dt>About</dt><dd>{sel.flat.description}</dd></>}
          </dl>
          <div className="table-wrap"><table><thead><tr><th>Room</th><th>Type</th><th>Beds free</th><th>Window</th><th>Bathroom</th><th>Facilities</th><th></th></tr></thead>
            <tbody>{sel.rooms.map((r) => (<tr key={r.id}><td>{r.room_number}</td><td>{r.room_type}</td><td>{r.available_beds}/{r.capacity}</td><td>{r.window_direction || '-'}</td><td>{r.attached_bathroom ? 'Attached' : 'Common'}</td><td>{csv(r.facilities)}</td>
              <td><button className="btn sm" disabled={r.available_beds < 1 || r.availability_status !== 'available' || active.length > 0} onClick={() => request(r.id)}>{r.available_beds < 1 ? 'Full' : 'Request'}</button></td></tr>))}</tbody></table></div>
          {active.length > 0 && <p className="muted" style={{ marginTop: 10 }}>You already have an open request or allocation this semester. Cancel it to choose another room.</p>}
        </Modal>)}
    </>
  );
}
