'use client';
// One animal: details, milk over the last 14 days, parents and calves,
// pedigree chart (fn_pedigree) and health history. The Owner can edit
// or delete it.
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, Badge, formatDate, litres } from '@/components/ui.js';

const GENERATION_NAMES = ['This animal', 'Parents', 'Grandparents', 'Great-grandparents'];

// Turns the fn_pedigree rows into a pedigree chart: one column per
// generation, each animal followed by its sire and dam in fixed slots,
// so every ancestor lines up with its own offspring. Each row's path
// ('Tulsi <- Radha <- Gauri') identifies whose parent it is.
function pedigreeColumns(rows) {
  const self = rows.find((r) => r.generation === 0);
  if (!self) return [];
  const deepest = Math.max(...rows.map((r) => r.generation));
  const columns = [[{ animal: self, relation: 'self' }]];
  for (let g = 1; g <= deepest; g += 1) {
    const column = [];
    for (const child of columns[g - 1]) {
      for (const relation of ['sire', 'dam']) {
        if (!child.animal) {
          // the child itself is unknown: keep the slot empty so the chart stays aligned
          column.push({ spacer: true });
          continue;
        }
        const parent = rows.find((r) => r.generation === g && r.relation === relation
          && r.path === `${child.animal.path} <- ${r.name}`);
        column.push({ animal: parent ?? null, relation, of: child.animal.name });
      }
    }
    columns.push(column);
  }
  return columns;
}

export default function AnimalPage() {
  const { id } = useParams();
  const router = useRouter();
  const user = useUser();
  const canSeeBreeding = user.role !== 'Farmhand';

  const animal = useApi(`/api/cattle/${id}`);
  const milk = useApi(`/api/milk?cattleId=${id}&days=14`);
  const pedigree = useApi(canSeeBreeding ? `/api/cattle/${id}/pedigree` : null);
  const health = useApi(canSeeBreeding ? `/api/health-records?cattleId=${id}` : null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  if (animal.loading && !animal.data) return <Loading what="animal" />;
  if (animal.error) return <Notice kind="error">{animal.error}</Notice>;
  const { animal: a, parents, calves } = animal.data;

  function startEdit() {
    setForm({ name: a.name ?? '', breed: a.breed, status: a.status });
    setEditing(true);
    setMessage({ kind: 'info', text: '' });
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/cattle/${id}`, { method: 'PATCH', body: { ...form, name: form.name || null } });
      setMessage({ kind: 'success', text: 'Changes saved.' });
      setEditing(false);
      animal.reload();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/cattle/${id}`, { method: 'DELETE' });
      router.push('/cattle');
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  // Milk bars: days below 80% of the cow's average are shown in red
  const days = [...(milk.data?.milk ?? [])].sort((x, y) => x.yield_date.localeCompare(y.yield_date));
  const average = days.length ? days.reduce((s, d) => s + Number(d.total_litres), 0) / days.length : 0;
  const most = Math.max(1, ...days.map((d) => Number(d.total_litres)));

  const generations = pedigreeColumns(pedigree.data?.pedigree ?? []);

  return (
    <>
      <p style={{ marginBottom: '0.75rem' }}><Link href="/cattle">All cattle</Link></p>
      <PageHeader title={<span className="row"><EarTag>{a.tag_number}</EarTag> {a.name ?? 'Unnamed'}</span>}>
        {user.role === 'Owner' && !editing && (
          <>
            <button type="button" className="button button-quiet" onClick={startEdit}>Edit</button>
            {confirmDelete ? (
              <>
                <button type="button" className="button button-danger" onClick={remove} disabled={busy}>Delete {a.tag_number} permanently</button>
                <button type="button" className="button button-quiet" onClick={() => setConfirmDelete(false)}>Keep</button>
              </>
            ) : (
              <button type="button" className="button button-quiet" onClick={() => setConfirmDelete(true)}>Delete</button>
            )}
          </>
        )}
      </PageHeader>

      <Notice kind={message.kind}>{message.text}</Notice>

      {editing ? (
        <form className="panel stack" onSubmit={save}>
          <div className="form-grid">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Breed"><input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} required /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Active</option><option>Sold</option><option>Deceased</option>
              </select>
            </Field>
          </div>
          <div className="form-actions">
            <button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="button button-quiet" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <dl className="facts panel">
          <div><dt>Breed</dt><dd>{a.breed}</dd></div>
          <div><dt>Sex</dt><dd>{a.sex === 'F' ? 'Female' : 'Male'}</dd></div>
          <div><dt>Born</dt><dd>{formatDate(a.date_of_birth)}</dd></div>
          <div><dt>Status</dt><dd><Badge>{a.status}</Badge></dd></div>
          {canSeeBreeding && (
            <>
              <div><dt>Dam</dt><dd>{parents ? <Link href={`/cattle/${parents.dam_id}`}>{parents.dam_name}</Link> : 'Not recorded'}</dd></div>
              <div><dt>Sire</dt><dd>{parents ? <Link href={`/cattle/${parents.sire_id}`}>{parents.sire_name}</Link> : 'Not recorded'}</dd></div>
            </>
          )}
        </dl>
      )}

      {days.length > 0 && (
        <section className="section">
          <h2>Milk, last 14 days</h2>
          <div className="panel bars">
            {days.map((d) => {
              const value = Number(d.total_litres);
              return (
                <div className="bar-row" key={d.yield_date}>
                  <span className="muted">{formatDate(d.yield_date).replace(/ \d{4}$/, '')}</span>
                  <span className="bar-track"><span className={`bar-fill${value < 0.8 * average ? ' is-low' : ''}`} style={{ width: `${(value / most) * 100}%`, display: 'block' }} /></span>
                  <span className="num">{litres(value)}</span>
                </div>
              );
            })}
            <p className="muted" style={{ marginTop: '0.5rem' }}>Average {litres(average)} a day. Red days are more than 20% below average.</p>
          </div>
        </section>
      )}

      {canSeeBreeding && (
        <section className="section">
          <h2>Pedigree</h2>
          {pedigree.loading ? <Loading what="pedigree" /> : generations.length <= 1 ? (
            <Empty>No parents are recorded for this animal.</Empty>
          ) : (
            <div className="pedigree">
              {generations.map((slots, g) => (
                <div className="pedigree-gen" key={g}>
                  <h3>{GENERATION_NAMES[g] ?? `Generation ${g}`}</h3>
                  <div className="pedigree-slots" style={{ gridTemplateRows: `repeat(${slots.length}, 1fr)` }}>
                    {slots.map((p, i) => {
                      if (p.spacer) return <div key={i} aria-hidden="true" />;
                      const label = p.relation === 'dam' ? 'Dam' : 'Sire';
                      const relation = g === 0 ? null : <span className="relation">{g === 1 ? label : `${label} of ${p.of}`}</span>;
                      return p.animal ? (
                        <Link key={i} href={`/cattle/${p.animal.cattle_id}`} className={`pedigree-animal is-${p.relation}`} title={p.animal.breed}>
                          {relation}<EarTag>{p.animal.tag_number}</EarTag><strong>{p.animal.name}</strong>
                        </Link>
                      ) : (
                        <div key={i} className="pedigree-animal is-unknown">{relation}<span className="muted">Not recorded</span></div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {calves?.length > 0 && (
            <p style={{ marginTop: '1rem' }}>
              Calves:{' '}
              {calves.map((c, i) => (
                <span key={c.cattle_id}>{i > 0 && ', '}<Link href={`/cattle/${c.cattle_id}`}>{c.name ?? c.tag_number}</Link> ({formatDate(c.date_of_birth)})</span>
              ))}
            </p>
          )}
        </section>
      )}

      {canSeeBreeding && (
        <section className="section">
          <h2>Health history</h2>
          {health.loading ? <Loading what="health records" /> : health.data?.records.length === 0 ? (
            <Empty>No examinations recorded.</Empty>
          ) : health.data && (
            <div className="table-wrap">
              <table className="wide">
                <thead><tr><th>Date</th><th>Suspected condition</th><th>Severity</th><th>Notes</th><th>Vet</th></tr></thead>
                <tbody>
                  {health.data.records.map((r) => (
                    <tr key={r.health_id}>
                      <td>{formatDate(r.record_date)}</td>
                      <td>{r.suspected_condition ?? 'Routine check'}</td>
                      <td><Badge>{r.severity}</Badge></td>
                      <td className="wrap" style={{ maxWidth: '40ch' }}>{r.vet_notes}</td>
                      <td>{r.vet_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
