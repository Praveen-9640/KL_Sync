import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, Empty, Field, Modal, PageHead, csv, fmtDate, todayStr } from '../components/ui.jsx';

export default function Projects() {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ domains: [], types: [] }); const [tab, setTab] = useState('all');
  const [f, setF] = useState({ q: '', domain: '', skill: '' }); const [items, setItems] = useState([]);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [form, setForm] = useState(null); const [join, setJoin] = useState(null); const [detail, setDetail] = useState(null);
  useEffect(() => { api.get('/projects/meta').then(setMeta).catch(() => {}); }, []);
  const load = useCallback(() => api.get(`/projects${qs({ ...f, mine: tab === 'mine' })}`).then((r) => setItems(r.projects)).catch((e) => setErr(e.message)), [f, tab]);
  useEffect(() => { const t = setTimeout(load, 150); return () => clearTimeout(t); }, [load]);
  const act = async (fn, msg) => { setErr(''); setOk(''); try { await fn(); setOk(msg); load(); setDetail(null); } catch (e) { setErr(e.message); } };
  const view = async (id) => { try { setDetail(await api.get(`/projects/${id}`)); } catch (e) { setErr(e.message); } };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const decide = async (pid, iid, decision) => { try { await api.post(`/projects/${pid}/interests/${iid}`, { decision }); setOk(`Request ${decision}`); load(); setDetail(await api.get(`/projects/${pid}`)); } catch (e) { setErr(e.message); } };
  return (
    <>
      <PageHead title="Project partners" subtitle="Find teammates for projects, hackathons and research." action={<button className="btn" onClick={() => setForm({})}><Plus size={16} />New project</button>} />
      <Alert>{err}</Alert><Alert kind="ok">{ok}</Alert>
      <div className="tabs"><button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>Looking for teammates</button><button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>My projects</button></div>
      <div className="toolbar"><input className="grow" placeholder="Search projects" value={f.q} onChange={set('q')} aria-label="Search" /><select value={f.domain} onChange={set('domain')} aria-label="Domain"><option value="">All domains</option>{meta.domains.map((d) => <option key={d}>{d}</option>)}</select><input placeholder="Filter by skill" value={f.skill} onChange={set('skill')} aria-label="Skill" /></div>
      {items.length === 0 ? <Empty>No projects found.</Empty> : (
        <div className="cards">{items.map((p) => { const mine = p.creator_id === user.id; return (
          <div className="card" key={p.id}>
            <div className="card-top"><h3>{p.title}</h3><Badge tone={p.status === 'open' ? 'ok' : 'neutral'}>{p.status}</Badge></div>
            <div className="meta"><span>{p.domain}</span><span>{p.project_type}</span>{p.deadline && <span>Due {fmtDate(p.deadline)}</span>}</div>
            <p>{p.description.length > 140 ? `${p.description.slice(0, 140)}…` : p.description}</p>
            <div className="chips" style={{ margin: '8px 0' }}>{p.required_skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
            <div className="meta"><span>Team: {p.current_team_size}</span><span>Needs {p.teammates_needed} more</span><span>By {mine ? 'you' : p.creator_name}</span></div>
            <div className="foot"><button className="btn ghost sm" onClick={() => view(p.id)}>{mine ? `Manage${p.pending_count ? ` (${p.pending_count})` : ''}` : 'Details'}</button>
              <span className="actions">
                {!mine && p.status === 'open' && !p.my_interest && <button className="btn sm" onClick={() => setJoin(p)}>Join</button>}
                {!mine && p.my_interest && <Badge tone={p.my_interest === 'accepted' ? 'ok' : p.my_interest === 'rejected' ? 'bad' : 'warn'}>{p.my_interest}</Badge>}
                {!mine && p.my_interest === 'pending' && <button className="btn danger sm" onClick={() => act(() => api.del(`/projects/${p.id}/interest`), 'Interest withdrawn')}>Withdraw</button>}
              </span></div>
          </div>); })}</div>)}
      {form && <ProjectForm meta={meta} project={form} onClose={() => setForm(null)} onDone={(m) => { setForm(null); setOk(m); load(); }} />}
      {join && <JoinForm project={join} onClose={() => setJoin(null)} onDone={() => { setJoin(null); setOk('Interest sent to the project creator'); load(); }} />}
      {detail && (
        <Modal title={detail.project.title} wide onClose={() => setDetail(null)}>
          <p style={{ marginBottom: 10 }}>{detail.project.description}</p>
          <dl className="kv"><dt>Domain</dt><dd>{detail.project.domain}</dd><dt>Type</dt><dd>{detail.project.project_type}</dd><dt>Required skills</dt><dd>{csv(detail.project.required_skills) || '-'}</dd><dt>Technologies</dt><dd>{csv(detail.project.technologies) || '-'}</dd>
            <dt>Team</dt><dd>{detail.project.current_team_size} now, {detail.project.teammates_needed} more needed</dd><dt>Deadline</dt><dd>{detail.project.deadline ? fmtDate(detail.project.deadline) : 'None'}</dd><dt>Creator</dt><dd>{detail.project.creator_name}</dd></dl>
          {detail.project.creator_id === user.id && <>
            <div className="actions" style={{ margin: '14px 0' }}>
              <button className="btn ghost sm" onClick={() => { setDetail(null); setForm(detail.project); }}>Edit</button>
              {detail.project.status === 'open' && <button className="btn ghost sm" onClick={() => act(() => api.post(`/projects/${detail.project.id}/status`, { status: 'closed' }), 'Project closed')}>Close recruiting</button>}
              {detail.project.status !== 'open' && <button className="btn ghost sm" onClick={() => act(() => api.post(`/projects/${detail.project.id}/status`, { status: 'open' }), 'Project reopened')}>Reopen</button>}
              {detail.project.status !== 'completed' && <button className="btn sm" onClick={() => act(() => api.post(`/projects/${detail.project.id}/status`, { status: 'completed' }), 'Project completed')}>Mark completed</button>}
              <button className="btn danger sm" onClick={() => window.confirm('Delete this project?') && act(() => api.del(`/projects/${detail.project.id}`), 'Project deleted')}>Delete</button></div>
            <h3>Interested students</h3>
            {detail.interests.length === 0 ? <p className="muted">Nobody yet.</p> : <ul className="list">{detail.interests.map((i) => (
              <li key={i.id}><span><b>{i.user.full_name}</b> <Badge tone={i.status === 'accepted' ? 'ok' : i.status === 'rejected' ? 'bad' : 'warn'}>{i.status}</Badge><br /><small>{[i.user.department, i.user.academic_year && `${i.user.academic_year} year`].filter(Boolean).join(' · ')}{i.user.skills.length ? ` · Skills: ${csv(i.user.skills)}` : ''}</small>{i.message && <><br />"{i.message}"</>}<br /><small>{[i.user.phone, i.user.email].filter(Boolean).join(' · ') || 'Contact hidden'}</small></span>
                {i.status === 'pending' && <span className="actions"><button className="btn sm" onClick={() => decide(detail.project.id, i.id, 'accepted')}>Accept</button><button className="btn danger sm" onClick={() => decide(detail.project.id, i.id, 'rejected')}>Reject</button></span>}</li>))}</ul>}
          </>}
        </Modal>)}
    </>
  );
}
function ProjectForm({ meta, project, onClose, onDone }) {
  const editing = Boolean(project.id);
  const [f, setF] = useState({ title: project.title || '', description: project.description || '', domain: project.domain || 'Web Development', project_type: project.project_type || 'academic',
    required_skills: csv(project.required_skills), technologies: csv(project.technologies), teammates_needed: project.teammates_needed || 1, current_team_size: project.current_team_size || 1, deadline: project.deadline || '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { editing ? await api.put(`/projects/${project.id}`, f) : await api.post('/projects', f); onDone(editing ? 'Project updated' : 'Project posted'); } catch (x) { setErr(x.message); setBusy(false); } };
  return (
    <Modal title={editing ? 'Edit project' : 'New project'} wide onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <Field label="Project title"><input value={f.title} onChange={set('title')} required maxLength={160} /></Field>
      <Field label="Description"><textarea value={f.description} onChange={set('description')} required maxLength={2000} /></Field>
      <div className="grid2"><Field label="Domain"><select value={f.domain} onChange={set('domain')}>{meta.domains.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Purpose"><select value={f.project_type} onChange={set('project_type')}>{meta.types.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="Required skills" hint="Comma separated"><input value={f.required_skills} onChange={set('required_skills')} placeholder="Python, Machine Learning" /></Field>
        <Field label="Preferred technologies" hint="Comma separated"><input value={f.technologies} onChange={set('technologies')} /></Field>
        <Field label="Teammates needed"><input type="number" min="1" max="20" value={f.teammates_needed} onChange={set('teammates_needed')} required /></Field>
        <Field label="Current team size"><input type="number" min="1" max="50" value={f.current_team_size} onChange={set('current_team_size')} required /></Field></div>
      <Field label="Deadline (optional)"><input type="date" min={todayStr()} value={f.deadline} onChange={set('deadline')} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Post project'}</button></form></Modal>
  );
}
function JoinForm({ project, onClose, onDone }) {
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.post(`/projects/${project.id}/interest`, { message: msg }); onDone(); } catch (x) { setErr(x.message); setBusy(false); } };
  return (
    <Modal title={`Join: ${project.title}`} onClose={onClose}><form onSubmit={submit}><Alert>{err}</Alert>
      <Field label="Tell the creator why you're a fit" hint="Mention your skills and availability."><textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send interest'}</button></form></Modal>
  );
}
