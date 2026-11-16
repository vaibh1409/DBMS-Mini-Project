'use client';
// Milk yield: record a reading (Owner, Farmhand), see daily totals or
// individual sessions, and yield drops (Owner, Vet).
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, formatDate, todayISO, litres } from '@/components/ui.js';

export default function MilkPage() {
  const user = useUser();
  const canRecord = user.role !== 'Vet';
  const canSeeAnomalies = user.role !== 'Farmhand';

  const [days, setDays] = useState('7');
  const [cattleId, setCattleId] = useState('');
  const [view, setView] = useState('daily');
  const query = new URLSearchParams({ days, view, ...(cattleId && { cattleId }) }).toString();
  const milk = useApi(`/api/milk?${query}`);
  const cows = useApi('/api/cattle?status=Active&sex=F');
  const anomalies = useApi(canSeeAnomalies ? '/api/milk/anomalies' : null);

  const [form, setForm] = useState({ cattleId: '', yieldDate: todayISO(), session: new Date().getHours() < 12 ? 'Morning' : 'Evening', litres: '' });
  const [message, setMessage] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  async function record(event) {
    event.preventDefault();
    setBusy(true);
    setMessage({ kind: 'info', text: '' });
    try {
      const { reading } = await api('/api/milk', { method: 'POST', body: form });
      const cow = cows.data.cattle.find((c) => c.cattle_id === reading.cattle_id);
      setMessage({ kind: 'success', text: `Recorded ${litres(reading.litres)} for ${cow?.name ?? cow?.tag_number} (${reading.session.toLowerCase()}, ${formatDate(reading.yield_date)}).` });
      setForm((f) => ({ ...f, cattleId: '', litres: '' }));
      milk.reload();
      anomalies.reload();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const rows = milk.data?.milk ?? [];
  const total = rows.reduce((s, r) => s + Number(view === 'daily' ? r.total_litres : r.litres), 0);

  return (
    <>
      <PageHeader title="Milk yield" description="Morning and evening readings for each cow." />

      {canRecord && (
        <form className="panel stack" onSubmit={record}>
          <h2>Record a reading</h2>
          <div className="form-grid">
            <Field label="Cow">
              <select value={form.cattleId} onChange={(e) => setForm({ ...form, cattleId: e.target.value })} required>
                <option value="">Choose a cow</option>
                {(cows.data?.cattle ?? []).map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={form.yieldDate} max={todayISO()} onChange={(e) => setForm({ ...form, yieldDate: e.target.value })} required /></Field>
            <Field label="Session">
              <select value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })}><option>Morning</option><option>Evening</option></select>
            </Field>
            <Field label="Litres"><input type="number" step="0.01" min="0" inputMode="decimal" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} required /></Field>
          </div>
          <Notice kind={message.kind}>{message.text}</Notice>
          <div className="form-actions"><button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save reading'}</button></div>
        </form>
      )}

      {canSeeAnomalies && (
        <section className="section">
          <h2>Yield drops</h2>
          <p className="muted" style={{ marginBottom: '0.75rem' }}>Cows whose average over the last 3 days is more than 20% below their usual yield.</p>
          {anomalies.loading ? <Loading what="yield drops" /> : anomalies.data?.anomalies.length === 0 ? (
            <Empty>No cow has a yield drop.</Empty>
          ) : anomalies.data && (
            <ul className="attention">
              {anomalies.data.anomalies.map((a) => (
                <li key={a.cattle_id}>
                  <EarTag>{a.tag_number}</EarTag>
                  <span className="what">
                    <Link href={`/cattle/${a.cattle_id}`}>{a.name}</Link>:{' '}
                    <span className="alert-text">{Math.abs(Number(a.change_pct))}% lower</span>, {Number(a.recent_avg).toFixed(1)} L a day against {Number(a.baseline_avg).toFixed(1)} L usually.
                    {a.latest_condition && <> Latest exam: {a.latest_condition} on {formatDate(a.latest_exam_date)}.</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Readings</h2>
          <div className="segmented" role="group" aria-label="Show">
            <button type="button" aria-pressed={view === 'daily'} onClick={() => setView('daily')}>Daily totals</button>
            <button type="button" aria-pressed={view === 'sessions'} onClick={() => setView('sessions')}>Each session</button>
          </div>
        </div>
        <div className="filters" style={{ maxWidth: '32rem' }}>
          <Field label="Cow">
            <select value={cattleId} onChange={(e) => setCattleId(e.target.value)}>
              <option value="">All cows</option>
              {(cows.data?.cattle ?? []).map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
            </select>
          </Field>
          <Field label="Period">
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
            </select>
          </Field>
        </div>

        <Notice kind="error">{milk.error}</Notice>
        {milk.loading && !milk.data ? <Loading what="readings" /> : milk.data && (
          rows.length === 0 ? <Empty>No readings in this period.</Empty> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    {view === 'daily'
                      ? <tr><th>Date</th><th>Cow</th><th className="num hide-narrow">Sessions</th><th className="num">Total</th></tr>
                      : <tr><th>Date</th><th>Cow</th><th>Session</th><th className="num">Litres</th><th>Recorded by</th></tr>}
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={view === 'daily' ? `${r.cattle_id}-${r.yield_date}` : r.yield_id}>
                        <td>{formatDate(r.yield_date)}</td>
                        <td><Link href={`/cattle/${r.cattle_id}`} className="row-link"><EarTag>{r.tag_number}</EarTag><span className="row-link-name">{r.name}</span></Link></td>
                        {view === 'daily' ? (
                          <><td className="num hide-narrow">{r.sessions_recorded}</td><td className="num">{litres(r.total_litres)}</td></>
                        ) : (
                          <><td>{r.session}</td><td className="num">{litres(r.litres)}</td><td>{r.recorded_by_name}</td></>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ marginTop: '0.5rem' }}>{litres(total)} in total</p>
            </>
          )
        )}
      </section>
    </>
  );
}
