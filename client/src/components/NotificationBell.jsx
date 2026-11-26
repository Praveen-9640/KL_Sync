import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../services/api.js';
import { fmtAgo } from './ui.jsx';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const ref = useRef(null);
  const load = () => api.get('/notifications').then(setData).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const markAll = async () => { await api.post('/notifications/read-all'); load(); };
  const markOne = async (n) => { if (!n.is_read) { await api.post(`/notifications/${n.id}/read`); load(); } };
  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label={`Notifications, ${data.unread} unread`}>
        <Bell size={20} />{data.unread > 0 && <span className="dot">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head"><strong>Notifications</strong>{data.unread > 0 && <button className="link" onClick={markAll}>Mark all read</button>}</div>
          {data.notifications.length === 0 && <p className="muted pad">You're all caught up.</p>}
          <ul>{data.notifications.map((n) => (
            <li key={n.id} className={n.is_read ? '' : 'unread'} onClick={() => markOne(n)}>
              <b>{n.title}</b><span>{n.message}</span><small>{fmtAgo(n.created_at)}</small>
            </li>))}</ul>
        </div>
      )}
    </div>
  );
}
