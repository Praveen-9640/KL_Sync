import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export const Field = ({ label, hint, children }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
);
export const Alert = ({ kind = 'error', children }) => (children ? <div className={`alert ${kind}`} role="alert">{children}</div> : null);
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Badge = ({ tone = 'neutral', children }) => <span className={`badge ${tone}`}>{children}</span>;
export const PageHead = ({ title, subtitle, action }) => (
  <div className="page-head"><div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>{action}</div>
);
export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (t) => { const [h, m] = t.split(':'); const hh = Number(h); return `${((hh + 11) % 12) + 1}:${m} ${hh >= 12 ? 'PM' : 'AM'}`; };
export const fmtAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return fmtDate(d);
};
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const csv = (arr) => (arr || []).join(', ');
