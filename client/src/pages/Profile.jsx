import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Field, csv, fmtDate, fmtTime } from '../components/ui.jsx';

export default function Profile() {
  const { setUser } = useAuth();
  const [data, setData] = useState(null); const [f, setF] = useState(null); const [editing, setEditing] = useState(false);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const load = () => api.get('/profile').then((r) => { setData(r); setF({ ...r.user, skills: csv(r.user.skills), interests: csv(r.user.interests) }); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  if (!data || !f) return <Alert>{err}</Alert>;
  const { user, activity } = data;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async (e) => { e.preventDefault(); setErr(''); try { const r = await api.put('/profile', f); setUser(r.user); setOk('Profile saved'); setEditing(false); load(); } catch (x) { setErr(x.message); } };
  return (
    <>
      <div className="page-head"><div><h1>{user.full_name}</h1><p className="muted">{user.student_id}{user.role === 'admin' && ' · Admin'}</p></div>{!editing && <button className="btn" onClick={() => { setEditing(true); setOk(''); }}>Edit profile</button>}</div>
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      {editing ? (
        <form className="card" onSubmit={save}>
          <div className="grid2"><Field label="Full name"><input value={f.full_name} onChange={set('full_name')} required /></Field><Field label="College"><input value={f.college || ''} onChange={set('college')} /></Field>
            <Field label="Department"><input value={f.department || ''} onChange={set('department')} /></Field><Field label="Academic year"><input value={f.academic_year || ''} onChange={set('academic_year')} /></Field>
            <Field label="Hostel"><input value={f.hostel_name || ''} onChange={set('hostel_name')} /></Field>
            <Field label="Block" hint="Set automatically once hostel management allocates your room."><input value={f.hostel_block || ''} onChange={set('hostel_block')} /></Field>
            <Field label="Flat"><input value={f.flat_number || ''} onChange={set('flat_number')} /></Field><Field label="Room"><input value={f.room_number || ''} onChange={set('room_number')} /></Field></div>
          <Field label="Skills" hint="Comma separated"><input value={f.skills} onChange={set('skills')} /></Field>
          <Field label="Interests" hint="Comma separated"><input value={f.interests} onChange={set('interests')} /></Field>
          <h3 style={{ margin: '8px 0' }}>Privacy</h3>
          <label className="check"><input type="checkbox" checked={f.show_email} onChange={set('show_email')} disabled={!user.email} />Show my email to students I interact with{!user.email && ' (no email on account)'}</label>
          <label className="check"><input type="checkbox" checked={f.show_phone} onChange={set('show_phone')} disabled={!user.phone} />Show my mobile number to students I interact with{!user.phone && ' (no mobile on account)'}</label>
          <div className="actions"><button className="btn">Save changes</button><button type="button" className="btn ghost" onClick={() => { setEditing(false); load(); }}>Cancel</button></div>
        </form>
      ) : (
        <div className="two-col">
          <div className="card"><dl className="kv">
            <dt>Student ID</dt><dd>{user.student_id}</dd><dt>College</dt><dd>{user.college || '-'}</dd><dt>Department</dt><dd>{user.department || '-'}</dd><dt>Academic year</dt><dd>{user.academic_year || '-'}</dd>
            <dt>Hostel</dt><dd>{user.hostel_name || '-'}</dd><dt>Block / Flat / Room</dt><dd>{[user.hostel_block, user.flat_number, user.room_number].map((x) => x || '-').join(' / ')}</dd>
            <dt>Skills</dt><dd>{csv(user.skills) || '-'}</dd><dt>Interests</dt><dd>{csv(user.interests) || '-'}</dd>
            <dt>Email</dt><dd>{user.email || '-'} {user.email && <Badge>{user.show_email ? 'visible to others' : 'private'}</Badge>}</dd><dt>Mobile</dt><dd>{user.phone || '-'} {user.phone && <Badge>{user.show_phone ? 'visible to others' : 'private'}</Badge>}</dd></dl></div>
          <div className="card"><h2>My active posts</h2>
            <h3 style={{ marginTop: 10 }}>Listings</h3>{activity.listings.length ? <ul className="list">{activity.listings.map((l) => <li key={l.id}><Link to="/market">{l.title}</Link><small>₹{l.price}</small></li>)}</ul> : <p className="muted">None</p>}
            <h3 style={{ marginTop: 10 }}>Play requests</h3>{activity.play_requests.length ? <ul className="list">{activity.play_requests.map((l) => <li key={l.id}><Link to="/play">{l.game_name}</Link><small>{fmtDate(l.play_date)} {fmtTime(l.play_time)}</small></li>)}</ul> : <p className="muted">None</p>}
            <h3 style={{ marginTop: 10 }}>Projects</h3>{activity.projects.length ? <ul className="list">{activity.projects.map((l) => <li key={l.id}><Link to="/projects">{l.title}</Link><small>{l.status}</small></li>)}</ul> : <p className="muted">None</p>}</div>
        </div>)}
    </>
  );
}
