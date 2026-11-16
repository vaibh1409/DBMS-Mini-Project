'use client';
// Breeding records (Owner, Vet). The Owner records breedings and,
// for pending ones, the calving (sp_record_calving).
import { useState } from 'react';
import Link from 'next/link';
import { useUser, RoleGate } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, Badge, formatDate, todayISO } from '@/components/ui.js';

export default function BreedingPage() {
  return <RoleGate allow={['Owner', 'Vet']}><Breeding /></RoleGate>;
}

function Breeding() {
  const user = useUser();
  const isOwner = user.role === 'Owner';
  const [outcome, setOutcome] = useState('');
  const records = useApi(`/api/breeding${outcome ? `?outcome=${outcome}` : ''}`);
  const cattle = useApi(isOwner ? '/api/cattle?status=Active' : null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ damId: '', sireId: '', breedingDate: todayISO(), method: 'AI' });
  const [calving, setCalving] = useState(null);   // breeding_id being closed
  const [calf, setCalf] = useState({ tagNumber: '', name: '', sex: 'F', breed: '', dateOfBirth: todayISO() });
  const [message, setMessage] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const cows = (cattle.data?.cattle ?? []).filter((c) => c.sex === 'F');
  const bulls = (cattle.data?.cattle ?? []).filter((c) => c.sex === 'M');

  async function run(action, success) {
    setBusy(true);
    setMessage({ kind: 'info', text: '' });
    try {
      const result = await action();
      setMessage({ kind: 'success', text: success(result) });
      records.reload();
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addBreeding(event) {
    event.preventDefault();
    const ok = await run(
      () => api('/api/breeding', { method: 'POST', body: form }),
      () => 'Breeding recorded as pending.',
    );
    if (ok) setAdding(false);
  }

  function openCalving(record) {
    setCalving(record.breeding_id);
    setCalf({ tagNumber: '', name: '', sex: 'F', breed: '', dateOfBirth: todayISO() });
  }

  async function recordCalving(event) {
    event.preventDefault();
    const ok = await run(
      () => api(`/api/breeding/${calving}/calving`, { method: 'POST', body: { ...calf, name: calf.name || null } }),
      (result) => `Calf ${result.calf.tag_number} added to the herd and the breeding marked as calved.`,
    );
    if (ok) setCalving(null);
  }

  return (
    <>
      <PageHeader title="Breeding" description="Breedings, their outcome and the calf born. A calving adds the calf to the herd and closes the breeding in one step.">
        {isOwner && !adding && <button type="button" className="button" onClick={() => setAdding(true)}>Record breeding</button>}
      </PageHeader>

      <Notice kind={message.kind}>{message.text}</Notice>

      {adding && (
        <form className="panel stack" onSubmit={addBreeding}>
          <h2>Record a breeding</h2>
          <div className="form-grid">
            <Field label="Dam (cow)">
              <select value={form.damId} onChange={(e) => setForm({ ...form, damId: e.target.value })} required>
                <option value="">Choose a cow</option>
                {cows.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
              </select>
            </Field>
            <Field label="Sire (bull)">
              <select value={form.sireId} onChange={(e) => setForm({ ...form, sireId: e.target.value })} required>
                <option value="">Choose a bull</option>
                {bulls.map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={form.breedingDate} max={todayISO()} onChange={(e) => setForm({ ...form, breedingDate: e.target.value })} required /></Field>
            <Field label="Method">
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="AI">Artificial insemination</option><option value="Natural">Natural</option>
              </select>
            </Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Record breeding'}</button>
            <button type="button" className="button button-quiet" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      <section className="section">
        <div className="filters" style={{ maxWidth: '16rem' }}>
          <Field label="Outcome">
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">All</option><option>Pending</option><option>Calved</option><option>Failed</option>
            </select>
          </Field>
        </div>

        <Notice kind="error">{records.error}</Notice>
        {records.loading && !records.data ? <Loading what="breeding records" /> : records.data && (
          records.data.breeding.length === 0 ? <Empty>No breeding records with this outcome.</Empty> : (
            <div className="table-wrap">
              <table className="wide">
                <thead><tr><th>Date</th><th>Dam</th><th>Sire</th><th>Method</th><th>Outcome</th><th>Calf</th>{isOwner && <th />}</tr></thead>
                <tbody>
                  {records.data.breeding.map((b) => (
                    <BreedingRow key={b.breeding_id} b={b} isOwner={isOwner} open={calving === b.breeding_id}
                      onCalve={() => openCalving(b)}>
                      <form className="stack" onSubmit={recordCalving}>
                        <h3>Record the calving for {b.dam_name}</h3>
                        <div className="form-grid">
                          <Field label="Calf tag number"><input value={calf.tagNumber} onChange={(e) => setCalf({ ...calf, tagNumber: e.target.value })} required placeholder="KA-6001" /></Field>
                          <Field label="Name" hint="Optional"><input value={calf.name} onChange={(e) => setCalf({ ...calf, name: e.target.value })} /></Field>
                          <Field label="Sex"><select value={calf.sex} onChange={(e) => setCalf({ ...calf, sex: e.target.value })}><option value="F">Female</option><option value="M">Male</option></select></Field>
                          <Field label="Breed"><input value={calf.breed} onChange={(e) => setCalf({ ...calf, breed: e.target.value })} required placeholder="e.g. Gir x Sahiwal" /></Field>
                          <Field label="Born on"><input type="date" value={calf.dateOfBirth} max={todayISO()} onChange={(e) => setCalf({ ...calf, dateOfBirth: e.target.value })} required /></Field>
                        </div>
                        <div className="form-actions">
                          <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Record calving'}</button>
                          <button type="button" className="button button-quiet" onClick={() => setCalving(null)}>Cancel</button>
                        </div>
                      </form>
                    </BreedingRow>
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

function BreedingRow({ b, isOwner, open, onCalve, children }) {
  return (
    <>
      <tr className={open ? 'is-open' : undefined}>
        <td>{formatDate(b.breeding_date)}</td>
        <td><Link href={`/cattle/${b.dam_id}`}>{b.dam_name}</Link></td>
        <td><Link href={`/cattle/${b.sire_id}`}>{b.sire_name}</Link></td>
        <td>{b.method === 'AI' ? 'AI' : 'Natural'}</td>
        <td><Badge>{b.outcome}</Badge></td>
        <td>{b.calf_id ? <Link href={`/cattle/${b.calf_id}`}>{b.calf_name ?? 'Calf'}</Link> : '–'}</td>
        {isOwner && (
          <td>{b.outcome === 'Pending' && !open && <button type="button" className="button button-small button-quiet" onClick={onCalve}>Record calving</button>}</td>
        )}
      </tr>
      {open && <tr><td colSpan={7} className="detail-cell">{children}</td></tr>}
    </>
  );
}
