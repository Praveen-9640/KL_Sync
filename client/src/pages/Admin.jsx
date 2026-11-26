import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Alert, Badge, Empty, Field, Modal, PageHead, csv, fmtDate } from '../components/ui.jsx';

const DIRS = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];
const TABS = ['Overview', 'Room requests', 'Flats & rooms', 'Students', 'Listings', 'Reports'];

export default function Admin() {
  const [tab, setTab] = useState('Overview'); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [d, setD] = useState({}); const [modal, setModal] = useState(null); const [q, setQ] = useState('');
  const load = useCallback(async () => {
    try {
      if (tab === 'Overview') setD({ stats: await api.get('/admin/stats') });
      if (tab === 'Room requests') setD({ allocations: (await api.get('/admin/allocations')).allocations });
      if (tab === 'Flats & rooms') setD({ flats: (await api.get('/rooms/flats')).flats });
      if (tab === 'Students') setD({ users: (await api.get(`/admin/users?q=${encodeURIComponent(q)}`)).users });
      if (tab === 'Listings') setD({ items: (await api.get('/admin/listings')).items });
      if (tab === 'Reports') setD({ reports: (await api.get('/admin/reports')).reports });
    } catch (e) { setErr(e.message); }
  }, [tab, q]);
  useEffect(() => { setErr(''); setOk(''); const t = setTimeout(load, 150); return () => clearTimeout(t); }, [load]);
  const act = async (fn, msg) => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <PageHead title="Hostel management" subtitle="Admin tools. Students cannot see this area." />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      <div className="tabs" style={{ overflowX: 'auto' }}>{TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === 'Overview' && d.stats && <div className="stat-grid">{[['Students', d.stats.students], ['Flats', d.stats.flats], ['Rooms', d.stats.rooms], ['Pending room requests', d.stats.pending_requests], ['Active listings', d.stats.active_listings], ['Open reports', d.stats.open_reports]].map(([l, n]) => <div className="card" key={l}><div className="num" style={{ fontSize: '1.7rem', fontWeight: 600 }}>{n}</div><div className="muted">{l}</div></div>)}</div>}

      {tab === 'Room requests' && (d.allocations?.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Room</th><th>Semester</th><th>Requested</th><th>Status</th><th></th></tr></thead><tbody>
        {d.allocations.map((a) => <tr key={a.id}><td>{a.full_name}<br /><small>{a.student_id}</small></td><td>Flat {a.flat_number}, room {a.room_number}</td><td>{a.semester}</td><td>{fmtDate(a.requested_at)}</td><td><Badge tone={a.allocation_status === 'allocated' ? 'ok' : a.allocation_status === 'requested' ? 'warn' : 'bad'}>{a.allocation_status}</Badge></td>
          <td className="actions">{a.allocation_status === 'requested' && <><button className="btn sm" onClick={() => act(() => api.post(`/admin/allocations/${a.id}`, { action: 'approve' }), 'Room allocated')}>Approve</button><button className="btn danger sm" onClick={() => act(() => api.post(`/admin/allocations/${a.id}`, { action: 'reject' }), 'Request rejected')}>Reject</button></>}
            {a.allocation_status === 'allocated' && <button className="btn danger sm" onClick={() => window.confirm('Cancel this allocation?') && act(() => api.post(`/admin/allocations/${a.id}`, { action: 'cancel' }), 'Allocation cancelled')}>Cancel</button>}</td></tr>)}</tbody></table></div> : d.allocations && <Empty>No room requests.</Empty>)}

      {tab === 'Flats & rooms' && <>
        <div className="actions" style={{ marginBottom: 14 }}><button className="btn" onClick={() => setModal({ type: 'flat', data: {} })}>Add flat</button></div>
        {d.flats?.length === 0 && <Empty>No flats yet. Add your first flat.</Empty>}
        {d.flats?.map((fl) => <div className="card" key={fl.id} style={{ marginBottom: 12 }}>
          <div className="card-top"><h3>Flat {fl.flat_number} · Block {fl.block_name} · Floor {fl.floor_number}</h3><span className="actions"><button className="btn ghost sm" onClick={() => setModal({ type: 'flat', data: fl })}>Edit flat</button><button className="btn sm" onClick={() => setModal({ type: 'room', flatId: fl.id, data: {} })}>Add room</button></span></div>
          <div className="table-wrap" style={{ marginTop: 10 }}><table><thead><tr><th>Room</th><th>Beds free</th><th>Status</th><th></th></tr></thead><tbody>
            {fl.rooms.map((r) => <tr key={r.id}><td>{r.room_number}</td><td>{r.available_beds}/{r.capacity}</td><td><Badge tone={r.availability_status === 'available' ? 'ok' : 'bad'}>{r.availability_status}</Badge></td>
              <td><button className="btn ghost sm" onClick={async () => { try { const full = await api.get(`/rooms/${r.id}`); setModal({ type: 'room', flatId: fl.id, data: full.room }); } catch (e) { setErr(e.message); } }}>Edit</button></td></tr>)}
            {fl.rooms.length === 0 && <tr><td colSpan={4} className="muted">No rooms for the current semester.</td></tr>}</tbody></table></div></div>)}
      </>}

      {tab === 'Students' && <><div className="toolbar"><input className="grow" placeholder="Search name or student ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Student ID</th><th>Contact</th><th>College</th><th>Room</th><th>Role</th></tr></thead><tbody>{d.users?.map((u) => <tr key={u.id}><td>{u.full_name}</td><td>{u.student_id}</td><td>{u.email || u.phone}</td><td>{u.college || '-'}</td><td>{[u.hostel_block, u.flat_number, u.room_number].filter(Boolean).join(' / ') || '-'}</td><td>{u.role}</td></tr>)}</tbody></table></div></>}

      {tab === 'Listings' && (d.items?.length ? <div className="table-wrap"><table><thead><tr><th>Item</th><th>Seller</th><th>Price</th><th>Status</th><th>Posted</th><th></th></tr></thead><tbody>
        {d.items.map((m) => <tr key={m.id}><td>{m.title}<br /><small>{m.category}</small></td><td>{m.seller_name}</td><td>₹{m.price}</td><td>{m.status}</td><td>{fmtDate(m.created_at)}</td><td><button className="btn danger sm" onClick={() => window.confirm('Remove this listing?') && act(() => api.del(`/admin/listings/${m.id}`), 'Listing removed')}>Remove</button></td></tr>)}</tbody></table></div> : d.items && <Empty>No listings.</Empty>)}

      {tab === 'Reports' && (d.reports?.length ? <div className="table-wrap"><table><thead><tr><th>Target</th><th>Reason</th><th>Reported by</th><th>Status</th><th></th></tr></thead><tbody>
        {d.reports.map((r) => <tr key={r.id}><td>{r.target_type} #{r.target_id}</td><td>{r.reason}</td><td>{r.reporter_name}</td><td><Badge tone={r.status === 'open' ? 'warn' : 'neutral'}>{r.status}</Badge></td>
          <td className="actions">{r.status === 'open' && <><button className="btn sm" onClick={() => act(() => api.post(`/admin/reports/${r.id}`, { status: 'resolved' }), 'Report resolved')}>Resolve</button><button className="btn ghost sm" onClick={() => act(() => api.post(`/admin/reports/${r.id}`, { status: 'dismissed' }), 'Report dismissed')}>Dismiss</button></>}
            {r.status === 'open' && r.target_type === 'marketplace' && <button className="btn danger sm" onClick={() => act(() => api.del(`/admin/listings/${r.target_id}`), 'Listing removed')}>Remove listing</button>}</td></tr>)}</tbody></table></div> : d.reports && <Empty>No reports.</Empty>)}

      {modal?.type === 'flat' && <FlatForm flat={modal.data} onClose={() => setModal(null)} onDone={(m) => { setModal(null); setOk(m); load(); }} />}
      {modal?.type === 'room' && <RoomForm room={modal.data} flatId={modal.flatId} onClose={() => setModal(null)} onDone={(m) => { setModal(null); setOk(m); load(); }} />}
    </>
  );
}
function useForm(initial, submitFn, onDone, msg) {
  const [f, setF] = useState(initial); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await submitFn(f); onDone(msg); } catch (x) { setErr(x.message); setBusy(false); } };
  return { f, set, err, busy, submit };
}
function FlatForm({ flat, onClose, onDone }) {
  const edit = Boolean(flat.id);
  const { f, set, err, busy, submit } = useForm({ block_name: flat.block_name || '', flat_number: flat.flat_number || '', floor_number: flat.floor_number ?? 0, total_rooms: flat.total_rooms || 1, balcony_available: flat.balcony_available || false, balcony_direction: flat.balcony_direction || '',
    kitchen: flat.kitchen || 'None', bathroom_type: flat.bathroom_type || 'Common', bathroom_details: flat.bathroom_details || '', facilities: csv(flat.facilities), description: flat.description || '' },
  (x) => (edit ? api.put(`/admin/flats/${flat.id}`, x) : api.post('/admin/flats', x)), onDone, edit ? 'Flat updated' : 'Flat added');
  return (
    <Modal title={edit ? `Edit flat ${flat.flat_number}` : 'Add flat'} wide onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <div className="grid3"><Field label="Block"><input value={f.block_name} onChange={set('block_name')} required /></Field><Field label="Flat number"><input value={f.flat_number} onChange={set('flat_number')} required /></Field><Field label="Floor"><input type="number" min="0" value={f.floor_number} onChange={set('floor_number')} required /></Field>
        <Field label="Total rooms"><input type="number" min="1" value={f.total_rooms} onChange={set('total_rooms')} required /></Field>
        <Field label="Kitchen"><select value={f.kitchen} onChange={set('kitchen')}>{['None', 'Shared', 'Private'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Bathroom"><select value={f.bathroom_type} onChange={set('bathroom_type')}>{['Common', 'Attached', 'Mixed'].map((x) => <option key={x}>{x}</option>)}</select></Field></div>
      <div className="grid2"><label className="check"><input type="checkbox" checked={f.balcony_available} onChange={set('balcony_available')} />Balcony available</label>
        <Field label="Balcony facing"><select value={f.balcony_direction} onChange={set('balcony_direction')} disabled={!f.balcony_available}><option value="">Select</option>{DIRS.map((x) => <option key={x}>{x}</option>)}</select></Field></div>
      <Field label="Common bathroom details"><input value={f.bathroom_details} onChange={set('bathroom_details')} /></Field>
      <Field label="Other facilities" hint="Comma separated"><input value={f.facilities} onChange={set('facilities')} /></Field>
      <Field label="Description"><textarea value={f.description} onChange={set('description')} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save flat'}</button></form></Modal>
  );
}
function RoomForm({ room, flatId, onClose, onDone }) {
  const edit = Boolean(room.id);
  const { f, set, err, busy, submit } = useForm({ room_number: room.room_number || '', room_type: room.room_type || 'Shared', capacity: room.capacity || 2, available_beds: room.available_beds ?? room.capacity ?? 2, window_direction: room.window_direction || '',
    attached_bathroom: room.attached_bathroom || false, facilities: csv(room.facilities), semester: room.semester || '', availability_status: room.availability_status || 'available', description: room.description || '' },
  (x) => (edit ? api.put(`/admin/rooms/${room.id}`, x) : api.post(`/admin/flats/${flatId}/rooms`, x)), onDone, edit ? 'Room updated' : 'Room added');
  return (
    <Modal title={edit ? `Edit room ${room.room_number}` : 'Add room'} wide onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <div className="grid3"><Field label="Room number"><input value={f.room_number} onChange={set('room_number')} required /></Field><Field label="Room type"><input value={f.room_type} onChange={set('room_type')} placeholder="Single / Double / Triple" /></Field>
        <Field label="Semester" hint="Leave empty for the current semester"><input value={f.semester} onChange={set('semester')} /></Field>
        <Field label="Capacity"><input type="number" min="1" value={f.capacity} onChange={set('capacity')} required /></Field><Field label="Available beds"><input type="number" min="0" value={f.available_beds} onChange={set('available_beds')} required /></Field>
        <Field label="Status"><select value={f.availability_status} onChange={set('availability_status')}>{['available', 'full', 'blocked'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Window facing"><select value={f.window_direction} onChange={set('window_direction')}><option value="">Select</option>{DIRS.map((x) => <option key={x}>{x}</option>)}</select></Field></div>
      <label className="check"><input type="checkbox" checked={f.attached_bathroom} onChange={set('attached_bathroom')} />Attached bathroom</label>
      <Field label="Facilities" hint="Comma separated"><input value={f.facilities} onChange={set('facilities')} /></Field>
      <Field label="Description"><textarea value={f.description} onChange={set('description')} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save room'}</button></form></Modal>
  );
}
