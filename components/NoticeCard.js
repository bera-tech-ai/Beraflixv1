import { AlertCircle, Film } from 'lucide-react';

export default function NoticeCard({ title, children, error = false, icon: Icon }) {
  const Mark = Icon || (error ? AlertCircle : Film);
  return <div className={`notice-card ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>
    <span className="notice-icon"><Mark size={22} /></span>
    <div><h3>{title}</h3><p>{children}</p></div>
  </div>;
}
