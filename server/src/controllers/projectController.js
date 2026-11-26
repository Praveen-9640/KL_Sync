const { asyncHandler, HttpError } = require('../utils/httpError');
const v = require('../utils/validate');
const { query, withTransaction } = require('../config/db');
const { notify } = require('../utils/notify');
const { publicUser } = require('../utils/publicUser');

const DOMAINS = ['Web Development', 'Mobile Apps', 'Data Science', 'AI / ML', 'IoT / Embedded', 'Cybersecurity', 'Core Engineering', 'Design', 'Research', 'Other'];
const TYPES = ['academic', 'hackathon', 'research', 'personal'];
const BASE = `SELECT p.id, p.creator_id, p.title, p.description, p.domain, p.required_skills, p.technologies, p.teammates_needed, p.current_team_size,
  to_char(p.deadline,'YYYY-MM-DD') AS deadline, p.project_type, p.status, p.created_at, u.full_name AS creator_name,
  (SELECT i.status FROM project_interests i WHERE i.project_id=p.id AND i.user_id=$1) AS my_interest,
  (SELECT COUNT(*)::int FROM project_interests i WHERE i.project_id=p.id AND i.status='pending') AS pending_count
  FROM projects p JOIN users u ON u.id=p.creator_id`;
const fields = (b) => ({
  title: v.str(b.title, 'Title', { max: 160 }), description: v.str(b.description, 'Description', { max: 2000 }), domain: v.oneOf(b.domain, 'Domain', DOMAINS),
  skills: v.list(b.required_skills, 'Required skills'), tech: v.list(b.technologies, 'Technologies'), needed: v.int(b.teammates_needed, 'Teammates needed', { min: 1, max: 20 }),
  cur: v.int(b.current_team_size ?? 1, 'Current team size', { min: 1, max: 50 }), deadline: v.date(b.deadline, 'Deadline', { optional: true }), type: v.oneOf(b.project_type, 'Project type', TYPES),
});
exports.meta = (_req, res) => res.json({ domains: DOMAINS, types: TYPES });

exports.create = asyncHandler(async (req, res) => {
  const f = fields(req.body);
  const { rows } = await query('INSERT INTO projects (creator_id,title,description,domain,required_skills,technologies,teammates_needed,current_team_size,deadline,project_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
    [req.user.id, f.title, f.description, f.domain, f.skills, f.tech, f.needed, f.cur, f.deadline, f.type]);
  res.status(201).json({ id: rows[0].id });
});
exports.list = asyncHandler(async (req, res) => {
  const { q, domain, skill, status, mine } = req.query;
  const p = [req.user.id]; const w = [];
  if (mine === 'true') w.push('p.creator_id=$1'); else w.push(`p.status='${status === 'closed' ? 'closed' : 'open'}'`);
  if (q) { p.push(`%${String(q).slice(0, 60)}%`); w.push(`(p.title ILIKE $${p.length} OR p.description ILIKE $${p.length})`); }
  if (domain) { p.push(domain); w.push(`p.domain=$${p.length}`); }
  if (skill) { p.push(`%${String(skill).slice(0, 40)}%`); w.push(`EXISTS (SELECT 1 FROM unnest(p.required_skills) s WHERE s ILIKE $${p.length})`); }
  const { rows } = await query(`${BASE} WHERE ${w.join(' AND ')} ORDER BY p.created_at DESC LIMIT 200`, p);
  res.json({ projects: rows });
});
exports.get = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const project = (await query(`${BASE} WHERE p.id=$2`, [req.user.id, id])).rows[0];
  if (!project) throw new HttpError(404, 'Project not found');
  let interests = [];
  if (project.creator_id === req.user.id) {
    const rs = (await query('SELECT i.id AS interest_id, i.message, i.status AS interest_status, i.created_at AS interest_at, u.* FROM project_interests i JOIN users u ON u.id=i.user_id WHERE i.project_id=$1 ORDER BY i.created_at', [id])).rows;
    interests = rs.map((r) => ({ id: r.interest_id, message: r.message, status: r.interest_status, created_at: r.interest_at, user: publicUser(r) }));
  }
  res.json({ project, interests });
});
const ownProject = async (id, userId) => {
  const pr = (await query('SELECT * FROM projects WHERE id=$1', [id])).rows[0];
  if (!pr) throw new HttpError(404, 'Project not found');
  if (pr.creator_id !== userId) throw new HttpError(403, 'Only the project creator can do this');
  return pr;
};
exports.update = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id); await ownProject(id, req.user.id); const f = fields(req.body);
  await query('UPDATE projects SET title=$1,description=$2,domain=$3,required_skills=$4,technologies=$5,teammates_needed=$6,current_team_size=$7,deadline=$8,project_type=$9 WHERE id=$10',
    [f.title, f.description, f.domain, f.skills, f.tech, f.needed, f.cur, f.deadline, f.type, id]);
  res.json({ message: 'Project updated' });
});
exports.setStatus = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id); await ownProject(id, req.user.id);
  const status = v.oneOf(req.body.status, 'Status', ['open', 'closed', 'completed']);
  await query('UPDATE projects SET status=$1 WHERE id=$2', [status, id]);
  res.json({ message: `Project marked ${status}` });
});
exports.remove = asyncHandler(async (req, res) => {
  await ownProject(v.id(req.params.id), req.user.id);
  await query('DELETE FROM projects WHERE id=$1', [req.params.id]);
  res.json({ message: 'Project deleted' });
});
exports.express = asyncHandler(async (req, res) => {
  const id = v.id(req.params.id);
  const pr = (await query('SELECT * FROM projects WHERE id=$1', [id])).rows[0];
  if (!pr) throw new HttpError(404, 'Project not found');
  if (pr.creator_id === req.user.id) throw new HttpError(400, 'You created this project');
  if (pr.status !== 'open') throw new HttpError(409, 'This project is not accepting teammates');
  const msg = v.str(req.body.message, 'Message', { max: 500, optional: true });
  try { await query('INSERT INTO project_interests (project_id,user_id,message) VALUES ($1,$2,$3)', [id, req.user.id, msg]); }
  catch (e) { if (e.code === '23505') throw new HttpError(409, 'You already expressed interest'); throw e; }
  const me = (await query('SELECT full_name FROM users WHERE id=$1', [req.user.id])).rows[0];
  await notify(pr.creator_id, 'New project interest', `${me.full_name} wants to join "${pr.title}".`, 'project');
  res.status(201).json({ message: 'Interest sent to the project creator' });
});
exports.withdraw = asyncHandler(async (req, res) => {
  const { rowCount } = await query("DELETE FROM project_interests WHERE project_id=$1 AND user_id=$2 AND status='pending'", [v.id(req.params.id), req.user.id]);
  if (!rowCount) throw new HttpError(404, 'No pending interest to withdraw');
  res.json({ message: 'Interest withdrawn' });
});
exports.decide = asyncHandler(async (req, res) => {
  const pid = v.id(req.params.id); const iid = v.id(req.params.interestId);
  const decision = v.oneOf(req.body.decision, 'Decision', ['accepted', 'rejected']);
  await withTransaction(async (db) => {
    const pr = (await db.query('SELECT * FROM projects WHERE id=$1 FOR UPDATE', [pid])).rows[0];
    if (!pr) throw new HttpError(404, 'Project not found');
    if (pr.creator_id !== req.user.id) throw new HttpError(403, 'Only the project creator can do this');
    const it = (await db.query('SELECT * FROM project_interests WHERE id=$1 AND project_id=$2 FOR UPDATE', [iid, pid])).rows[0];
    if (!it) throw new HttpError(404, 'Interest not found');
    if (it.status !== 'pending') throw new HttpError(409, `Already ${it.status}`);
    if (decision === 'accepted') {
      const accepted = (await db.query("SELECT COUNT(*)::int AS n FROM project_interests WHERE project_id=$1 AND status='accepted'", [pid])).rows[0].n;
      if (accepted >= pr.teammates_needed) throw new HttpError(409, 'All open spots are already filled');
      await db.query('UPDATE projects SET current_team_size=current_team_size+1 WHERE id=$1', [pid]);
      if (accepted + 1 >= pr.teammates_needed) await db.query("UPDATE projects SET status='closed' WHERE id=$1", [pid]);
    }
    await db.query('UPDATE project_interests SET status=$1 WHERE id=$2', [decision, iid]);
    await notify(it.user_id, `Project request ${decision}`, `Your request to join "${pr.title}" was ${decision}.`, 'project', db);
  });
  res.json({ message: `Request ${decision}` });
});
