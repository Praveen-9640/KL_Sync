import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Gamepad2, Store, HandHelping, Users } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Empty, fmtAgo } from '../components/ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/profile/dashboard').then(setD).catch((e) => setErr(e.message)); }, []);
  const tiles = d && [
    { to: '/rooms', icon: BedDouble, n: d.counts.rooms_available, label: 'rooms with free beds' },
    { to: '/play', icon: Gamepad2, n: d.counts.play_open, label: 'games looking for players' },
    { to: '/market', icon: Store, n: d.counts.market_items, label: 'items for sale' },
    { to: '/needs', icon: HandHelping, n: d.counts.needs_open, label: 'open item requests' },
    { to: '/projects', icon: Users, n: d.counts.projects_open, label: 'projects need teammates' },
  ];
  return (
    <>
      <div className="page-head"><div><h1>Welcome, {user.full_name.split(' ')[0]}</h1><p className="muted">{[user.college, user.hostel_block && `Block ${user.hostel_block}`, user.room_number && `Room ${user.room_number}`].filter(Boolean).join(' · ') || 'Complete your profile to help others find you.'}</p></div></div>
      <Alert>{err}</Alert>
      {tiles && <div className="stat-grid">{tiles.map(({ to, icon: Icon, n, label }) => (
        <Link key={to} to={to} className="card stat"><div className="ic"><Icon size={22} /></div><div className="num">{n}</div><div className="muted">{label}</div></Link>))}</div>}
      <div className="two-col">
        <div className="card"><h2>Recent activity</h2>
          {d && d.recent.length === 0 && <Empty>Nothing yet. Be the first to post something.</Empty>}
          <ul className="list">{d?.recent.map((r, i) => (<li key={i}><span><Link to={r.link}>{r.title}</Link> <small>({r.kind})</small></span><small>{fmtAgo(r.created_at)}</small></li>))}</ul>
        </div>
        <div className="card"><h2>Notifications</h2>
          <p className="muted" style={{ margin: '8px 0 12px' }}>{d ? (d.counts.unread ? `You have ${d.counts.unread} unread notification${d.counts.unread > 1 ? 's' : ''}.` : 'No unread notifications.') : ''} Open the bell at the top right to read them.</p>
          <div className="actions"><Link className="btn ghost sm" to="/play">Create a game</Link><Link className="btn ghost sm" to="/market">Sell an item</Link><Link className="btn ghost sm" to="/needs">Ask to borrow</Link></div>
        </div>
      </div>
    </>
  );
}
