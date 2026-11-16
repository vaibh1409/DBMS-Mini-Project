'use client';
// Health records (Owner, Vet). Vets add examinations; saving one also
// stores its note's embedding for similar-case search. Editing a note
// re-embeds it; deleting a record removes its embedding too.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser, RoleGate } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, Badge, formatDate, todayISO } from '@/components/ui.js';

const SEVERITIES = ['Mild', 'Moderate', 'Severe'];

export default function HealthPage() {
  return <RoleGate allow={['Owner', 'Vet']}><Health /></RoleGate>;
}

function Health() {
  const user = useUser();
  const [filters, setFilters] = useState({ cattleId: '', condition: '', severity: '' });
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const records = useApi(`/api/health-records${query ? `?${query}` : ''}`);
  const all = useApi('/api/health-records');
  const cattle = useApi('/api/cattle');

  const conditions = useMemo(
    () => [...new Set((all.data?.records ?? []).map((r) => r.suspected_condition).filter(Boolean))].sort(),
    [all.data],
  );

  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [message, setMessage] = useState({ kind: 'info', text: '' });

  function changed(text) {
    setMessage({ kind: 'success', text });
    records.reload();
    all.reload();
  }

  return (
    <>
      <PageHeader title="Health records" description="Vet examinations. Each note is also stored as a vector so similar past cases can be found.">
        {user.role === 'Vet' && !adding && <button type="button" className="button" onClick={() => setAdding(true)}>Add examination</button>}
      </PageHeader>

      <Notice kind={message.kind}>{message.text}</Notice>

      {adding && (
        <AddExamination
          cattle={(cattle.data?.cattle ?? []).filter((c) => c.status === 'Active')}
          conditions={conditions}
          onCancel={() => setAdding(false)}
          onSaved={(r) => { setAdding(false); changed(`Examination saved and added to similar-case search (record ${r.health_id}).`); }}
        />
      )}

      <section className="section">
        <div className="filters">
          <Field label="Animal">
            <select value={filters.cattleId} onChange={(e) => setFilters({ ...filters, cattleId: e.target.value })}>
              <option value="">All animals</option>
              {(cattle.data?.cattle ?? []).map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
            </select>
          </Field>
          <Field label="Suspected condition">
            <select value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })}>
              <option value="">All</option>{conditions.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
              <option value="">All</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Notice kind="error">{records.error}</Notice>
        {records.loading && !records.data ? <Loading what="health records" /> : records.data && (
          records.data.records.length === 0 ? <Empty>No examinations match these filters.</Empty> : (
            <div className="table-wrap">
              <table className="wide">
                <thead><tr><th>Date</th><th>Animal</th><th>Suspected condition</th><th>Severity</th><th>Vet</th><th>In search</th><th /></tr></thead>
                <tbody>
                  {records.data.records.map((r) => (
                    <RecordRow key={r.health_id} r={r} open={openId === r.health_id} conditions={conditions}
                      onToggle={() => setOpenId(openId === r.health_id ? null : r.health_id)}
                      onChanged={(text) => { setOpenId(null); changed(text); }}
                      onDeleted={() => { setOpenId(null); changed('Examination deleted. Its vector was removed with it.'); }}
                      onError={(text) => setMessage({ kind: 'error', text })} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </>
  );
}

function AddExamination({ cattle, conditions, onCancel, onSaved }) {
  const [form, setForm] = useState({ cattleId: '', recordDate: todayISO(), vetNotes: '', suspectedCondition: '', treatment: '', severity: 'Mild' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { record } = await api('/api/health-records', {
        method: 'POST',
        body: { ...form, suspectedCondition: form.suspectedCondition || null, treatment: form.treatment || null },
      });
      onSaved(record);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={save}>
      <h2>Add an examination</h2>
      <div className="form-grid">
        <Field label="Animal">
          <select value={form.cattleId} onChange={set('cattleId')} required>
            <option value="">Choose an animal</option>
            {cattle.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={form.recordDate} max={todayISO()} onChange={set('recordDate')} required /></Field>
        <Field label="Severity">
          <select value={form.severity} onChange={set('severity')}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="Suspected condition" hint="Optional">
          <input value={form.suspectedCondition} onChange={set('suspectedCondition')} list="condition-options" />
          <datalist id="condition-options">{conditions.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <Field label="Vet notes" hint="Symptoms and observations in your own words. These are used to find similar past cases.">
        <textarea value={form.vetNotes} onChange={set('vetNotes')} required />
      </Field>
      <Field label="Treatment" hint="Optional"><input value={form.treatment} onChange={set('treatment')} /></Field>
      <Notice kind="error">{error}</Notice>
      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save examination'}</button>
        <button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function RecordRow({ r, open, conditions, onToggle, onChanged, onDeleted, onError }) {
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle() {
    setForm({ vetNotes: r.vet_notes, suspectedCondition: r.suspected_condition ?? '', treatment: r.treatment ?? '', severity: r.severity });
    setConfirmDelete(false);
    onToggle();
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/health-records/${r.health_id}`, {
        method: 'PATCH',
        body: { ...form, suspectedCondition: form.suspectedCondition || null, treatment: form.treatment || null },
      });
      onChanged(`Record ${r.health_id} saved and its note re-embedded.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/health-records/${r.health_id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      onError(err.message);
      setBusy(false);
    }
  }

  // A record without a vector is not found by similar-case search;
  // this creates its vector again from the note
  async function addToSearch() {
    setBusy(true);
    try {
      await api(`/api/notes/${r.health_id}/embedding`, { method: 'POST' });
      onChanged(`Record ${r.health_id} is back in similar-case search.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className={open ? 'is-open' : undefined}>
        <td>{formatDate(r.record_date)}</td>
        <td><Link href={`/cattle/${r.cattle_id}`} className="row-link"><EarTag>{r.tag_number}</EarTag><span className="row-link-name">{r.cattle_name}</span></Link></td>
        <td>{r.suspected_condition ?? 'Routine check'}</td>
        <td><Badge>{r.severity}</Badge></td>
        <td>{r.vet_name}</td>
        <td>
          {r.has_embedding ? 'Yes' : (
            <button type="button" className="button button-small button-quiet" onClick={addToSearch} disabled={busy}>Add to search</button>
          )}
        </td>
        <td><button type="button" className="button button-small button-quiet" onClick={toggle} aria-expanded={open}>{open ? 'Close' : 'Open'}</button></td>
      </tr>
      {open && form && (
        <tr>
          <td colSpan={7} className="detail-cell">
            <form className="stack" onSubmit={save}>
              <Field label="Vet notes" hint="Changing the notes re-creates this record's vector."><textarea value={form.vetNotes} onChange={(e) => setForm({ ...form, vetNotes: e.target.value })} required /></Field>
              <div className="form-grid">
                <Field label="Suspected condition">
                  <input value={form.suspectedCondition} onChange={(e) => setForm({ ...form, suspectedCondition: e.target.value })} list="condition-options-edit" />
                  <datalist id="condition-options-edit">{conditions.map((c) => <option key={c} value={c} />)}</datalist>
                </Field>
                <Field label="Treatment"><input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} /></Field>
                <Field label="Severity">
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
                </Field>
              </div>
              <div className="form-actions">
                <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                {confirmDelete ? (
                  <>
                    <button type="button" className="button button-danger" onClick={remove} disabled={busy}>Delete this examination</button>
                    <button type="button" className="button button-quiet" onClick={() => setConfirmDelete(false)}>Keep it</button>
                  </>
                ) : (
                  <button type="button" className="button button-quiet" onClick={() => setConfirmDelete(true)}>Delete</button>
                )}
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
