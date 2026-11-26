import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BedDouble, Gamepad2, Store, HandHelping, Users, User, Settings, LogOut, Menu, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from '../components/NotificationBell.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/rooms', label: 'Room Selection', icon: BedDouble },
  { to: '/play', label: 'Peer to Play', icon: Gamepad2 },
  { to: '/market', label: 'Things Exchange', icon: Store },
  { to: '/needs', label: 'Need / Lend', icon: HandHelping },
  { to: '/projects', label: 'Project Partners', icon: Users },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => setOpen(false), [loc.pathname]);
  const search = (e) => { e.preventDefault(); if (q.trim()) nav(`/market?q=${encodeURIComponent(q.trim())}`); };
  const out = async () => { await logout(); nav('/login'); };
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span className="logo">H</span> HostelHub<button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (<NavLink key={to} to={to} end={end}><Icon size={18} />{label}</NavLink>))}
          {user.role === 'admin' && <NavLink to="/admin"><ShieldCheck size={18} />Admin</NavLink>}
        </nav>
        <button className="nav-logout" onClick={out}><LogOut size={18} />Logout</button>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <form className="search" onSubmit={search}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the marketplace…" aria-label="Search marketplace" /></form>
          <NotificationBell />
          <NavLink to="/profile" className="avatar" title={user.full_name}>{user.full_name.slice(0, 1).toUpperCase()}</NavLink>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
