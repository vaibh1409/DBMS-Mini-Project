'use client';
// Herd list with filters. The Owner can add animals.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, Badge, formatDate } from '@/components/ui.js';

const EMPTY_FORM = { tagNumber: '', name: '', breed: '', sex: 'F', dateOfBirth: '' };

export default function CattlePage() {
  const user = useUser();
  const [filters, setFilters] = useState({ q: '', status: 'Active', sex: '', breed: '' });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const list = useApi(`/api/cattle${query ? `?${query}` : ''}`);
  const all = useApi('/api/cattle');   // for the breed choices
  const breeds = useMemo(() => [...new Set((all.data?.cattle ?? []).map((c) => c.breed))].sort(), [all.data]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function addAnimal(event) {
    event.preventDefault();
    setBusy(true);
    setMessage({ kind: 'info', text: '' });
    try {
      const { animal } = await api('/api/cattle', { method: 'POST', body: { ...form, name: form.name || null } });
      setMessage({ kind: 'success', text: `Added ${animal.tag_number}${animal.name ? ` (${animal.name})` : ''} to the herd.` });
      setForm(EMPTY_FORM);
      setAdding(false);
      list.reload();
      all.reload();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Cattle" description="Every animal on the farm. Open an animal to see its details, pedigree and milk record.">
        {user.role === 'Owner' && !adding && (
          <button type="button" className="button" onClick={() => setAdding(true)}>Add animal</button>
        )}
      </PageHeader>

      <Notice kind={message.kind}>{message.text}</Notice>

      {adding && (
        <form className="panel stack" onSubmit={addAnimal}>
          <h2>Add an animal</h2>
          <div className="form-grid">
            <Field label="Tag number"><input value={form.tagNumber} onChange={setField('tagNumber')} required placeholder="KA-6001" /></Field>
            <Field label="Name" hint="Optional"><input value={form.name} onChange={setField('name')} /></Field>
            <Field label="Breed">
              <input value={form.breed} onChange={setField('breed')} required list="breed-options" />
              <datalist id="breed-options">{breeds.map((b) => <option key={b} value={b} />)}</datalist>
            </Field>
            <Field label="Sex">
              <select value={form.sex} onChange={setField('sex')}><option value="F">Female</option><option value="M">Male</option></select>
            </Field>
            <Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={setField('dateOfBirth')} required /></Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="button" disabled={busy}>{busy ? 'Adding…' : 'Add animal'}</button>
            <button type="button" className="button button-quiet" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      <section className="section">
        <div className="filters">
          <Field label="Search"><input type="search" value={filters.q} onChange={setFilter('q')} placeholder="Tag or name" /></Field>
          <Field label="Status">
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="">All</option><option>Active</option><option>Sold</option><option>Deceased</option>
            </select>
          </Field>
          <Field label="Sex">
            <select value={filters.sex} onChange={setFilter('sex')}><option value="">All</option><option value="F">Female</option><option value="M">Male</option></select>
          </Field>
          <Field label="Breed">
            <select value={filters.breed} onChange={setFilter('breed')}>
              <option value="">All</option>{breeds.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
        </div>

        <Notice kind="error">{list.error}</Notice>
        {list.loading && !list.data ? <Loading what="cattle" /> : list.data && (
          list.data.cattle.length === 0 ? <Empty>No animals match these filters.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Animal</th><th>Breed</th><th>Sex</th><th>Born</th><th className="num">Age</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {list.data.cattle.map((c) => (
                    <tr key={c.cattle_id}>
                      <td><Link href={`/cattle/${c.cattle_id}`} className="row-link"><EarTag>{c.tag_number}</EarTag><span className="row-link-name">{c.name ?? 'Unnamed'}</span></Link></td>
                      <td>{c.breed}</td>
                      <td>{c.sex === 'F' ? 'Female' : 'Male'}</td>
                      <td>{formatDate(c.date_of_birth)}</td>
                      <td className="num">{c.age_years} {c.age_years === 1 ? 'yr' : 'yrs'}</td>
                      <td><Badge>{c.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {list.data && <p className="muted" style={{ marginTop: '0.5rem' }}>{list.data.cattle.length} animals</p>}
      </section>
    </>
  );
}
