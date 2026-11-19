'use client';
// Predicted conditions (Owner, Vet): the likely condition behind each vet
// note, found by comparing the note's vector with the typical signs of
// each condition. Symptoms can also be typed in for a prediction.
import { useState } from 'react';
import Link from 'next/link';
import { RoleGate } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, formatDate } from '@/components/ui.js';

export default function PredictionsPage() {
  return <RoleGate allow={['Owner', 'Vet']}><Predictions /></RoleGate>;
}

const percent = (value) => `${Math.round(Number(value) * 100)}%`;

function Predictions() {
  const notes = useApi('/api/notes/predictions');
  const [text, setText] = useState('');
  const [typed, setTyped] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function predict(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setTyped((await api('/api/notes/predictions', { method: 'POST', body: { text } })).predictions);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const rows = notes.data?.notes ?? [];
  const checked = rows.filter((r) => r.recorded_condition);
  const agree = checked.filter((r) => r.predictions[0].condition === r.recorded_condition).length;

  return (
    <>
      <PageHeader
        title="Predicted conditions"
        description="The likely condition behind each vet note, predicted from the meaning of the note: its vector is compared with the typical signs of each condition."
      />

      <form className="panel stack" onSubmit={predict}>
        <Field label="Symptoms">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: cow down after calving, cold ears, trembling" required minLength={3} />
        </Field>
        <div className="row">
          <button type="submit" className="button" disabled={busy}>{busy ? 'Predicting…' : 'Predict condition'}</button>
        </div>
        {typed && (
          <p>
            Most likely <strong>{typed[0].condition}</strong> ({percent(typed[0].similarity)} match).
            {' '}Next: {typed.slice(1).map((p) => `${p.condition} (${percent(p.similarity)})`).join(', ')}.
          </p>
        )}
      </form>
      <Notice kind="error">{error || notes.error}</Notice>

      <section className="section">
        <div className="section-head">
          <h2>Vet notes</h2>
          {checked.length > 0 && <span className="muted">Prediction agrees with the vet on {agree} of {checked.length} notes</span>}
        </div>
        {notes.loading ? <Loading what="predictions" /> : rows.length === 0 ? <Empty>No vet notes are in search yet.</Empty> : (
          <div className="table-wrap">
            <table className="wide">
              <thead><tr><th>Date</th><th>Animal</th><th>Vet notes</th><th>Predicted</th><th>Vet recorded</th><th>Other possibilities</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const [top, ...rest] = r.predictions;
                  const differs = r.recorded_condition && r.recorded_condition !== top.condition;
                  return (
                    <tr key={r.health_id}>
                      <td>{formatDate(r.record_date)}</td>
                      <td><Link href={`/cattle/${r.cattle_id}`} className="row-link"><EarTag>{r.tag_number}</EarTag><span className="row-link-name">{r.cattle_name}</span></Link></td>
                      <td style={{ whiteSpace: 'normal', minWidth: '16rem' }}>{r.vet_notes}</td>
                      <td><strong>{top.condition}</strong> <span className="muted">{percent(top.similarity)}</span></td>
                      <td className={differs ? 'alert-text' : undefined}>{r.recorded_condition ?? 'Not recorded'}</td>
                      <td className="muted">{rest.map((p) => `${p.condition} ${percent(p.similarity)}`).join(', ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
