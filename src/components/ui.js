// Small building blocks shared by the pages.

// Tag numbers are shown as yellow ear tags, like the tags on the animals
export function EarTag({ children }) {
  return <span className="ear-tag">{children}</span>;
}

export function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

// kind: 'error' | 'success' | 'info'
export function Notice({ kind = 'info', children }) {
  if (!children) return null;
  return (
    <p className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Loading({ what = 'records' }) {
  return <p className="muted">Loading {what}…</p>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

// Badge colour follows the meaning of the value
const BADGE_TONES = {
  Active: 'good', Calved: 'good', Mild: 'calm', Upcoming: 'calm',
  Pending: 'wait', Moderate: 'wait', 'Due Today': 'wait',
  Severe: 'alert', Overdue: 'alert', Failed: 'alert',
  Sold: 'muted', Deceased: 'muted',
};

export function Badge({ children }) {
  return <span className={`badge badge-${BADGE_TONES[children] ?? 'calm'}`}>{children}</span>;
}

// '2026-11-13' -> '13 Nov 2026'
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function formatDate(value) {
  if (!value) return '–';
  return dateFormat.format(new Date(`${String(value).slice(0, 10)}T00:00:00Z`));
}

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function litres(value) {
  return `${Number(value).toFixed(1)} L`;
}
