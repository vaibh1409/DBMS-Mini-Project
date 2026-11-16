'use client';
// Vaccinations (Owner, Vet): doses due or overdue (fn_vaccinations_due),
// vaccinating several animals at once (Vet, sp_vaccinate_herd), and the
// dose history. Due dates are filled in by a database trigger.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser, RoleGate } from '@/components/AppShell.js';
import { api, useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Field, Loading, Empty, Badge, formatDate, todayISO } from '@/components/ui.js';

export default function VaccinationsPage() {
  return <RoleGate allow={['Owner', 'Vet']}><Vaccinations /></RoleGate>;
}

function Vaccinations() {
  const user = useUser();
  const isVet = user.role === 'Vet';
  const [within, setWithin] = useState('0');
  const [historyCattle, setHistoryCattle] = useState('');
  const due = useApi(`/api/vaccinations?dueWithin=${within}`);
  const history = useApi(`/api/vaccinations${historyCattle ? `?cattleId=${historyCattle}` : ''}`);
  const allHistory = useApi('/api/vaccinations');
  const cattle = useApi('/api/cattle?status=Active');

  // Usual interval for each vaccine, from its most recent dose
  const intervals = useMemo(() => {
    const map = new Map();
    for (const v of allHistory.data?.vaccinations ?? []) if (!map.has(v.vaccine_name)) map.set(v.vaccine_name, v.interval_days);
    return map;
  }, [allHistory.data]);

  const [form, setForm] = useState({ vaccineName: '', intervalDays: '', administeredDate: todayISO(), cattleIds: [] });
  const [message, setMessage] = useState({ kind: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  function chooseVaccine(name) {
    setForm((f) => ({ ...f, vaccineName: name, intervalDays: intervals.get(name) ?? f.intervalDays }));
  }

  function toggleAnimal(id) {
    setForm((f) => ({ ...f, cattleIds: f.cattleIds.includes(id) ? f.cattleIds.filter((x) => x !== id) : [...f.cattleIds, id] }));
  }

  function addFromDue(v) {
    setForm((f) => ({
      ...f,
      vaccineName: v.vaccine_name,
      intervalDays: intervals.get(v.vaccine_name) ?? f.intervalDays,
      cattleIds: f.vaccineName === v.vaccine_name ? [...new Set([...f.cattleIds, v.cattle_id])] : [v.cattle_id],
    }));
    document.getElementById('vaccinate')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function vaccinate(event) {
    event.preventDefault();
    if (form.cattleIds.length === 0) {
      setMessage({ kind: 'error', text: 'Choose at least one animal.' });
      return;
    }
    setBusy(true);
    setMessage({ kind: 'info', text: '' });
    try {
      const result = await api('/api/vaccinations', { method: 'POST', body: { ...form, intervalDays: Number(form.intervalDays) } });
      setMessage({ kind: 'success', text: `Recorded ${result.vaccineName} for ${result.recorded} ${result.recorded === 1 ? 'animal' : 'animals'}.` });
      setForm((f) => ({ ...f, cattleIds: [] }));
      due.reload();
      history.reload();
      allHistory.reload();
    } catch (err) {
      setMessage({ kind: 'error', text: `${err.message} None of the doses were recorded.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Vaccinations" description="Next due dates are worked out by the database from the date given and the vaccine's interval." />

      <section>
        <div className="section-head">
          <h2>Due</h2>
          <Field label="Show">
            <select value={within} onChange={(e) => setWithin(e.target.value)}>
              <option value="0">Due today or overdue</option><option value="7">Due within 7 days</option><option value="30">Due within 30 days</option>
            </select>
          </Field>
        </div>
        <Notice kind="error">{due.error}</Notice>
        {due.loading && !due.data ? <Loading what="due vaccinations" /> : due.data && (
          due.data.vaccinations.length === 0 ? <Empty>No vaccinations are due in this period.</Empty> : (
            <div className="table-wrap">
              <table className="wide">
                <thead><tr><th>Animal</th><th>Vaccine</th><th>Last dose</th><th>Next due</th><th>Status</th>{isVet && <th />}</tr></thead>
                <tbody>
                  {due.data.vaccinations.map((v) => (
                    <tr key={`${v.cattle_id}-${v.vaccine_name}`}>
                      <td><Link href={`/cattle/${v.cattle_id}`} className="row-link"><EarTag>{v.tag_number}</EarTag><span className="row-link-name">{v.name}</span></Link></td>
                      <td>{v.vaccine_name}</td>
                      <td>{formatDate(v.last_dose)}</td>
                      <td>{formatDate(v.next_due_date)}</td>
                      <td>
                        <Badge>{v.due_status}</Badge>{' '}
                        <span className="muted num">{v.days_until_due < 0 ? `${-v.days_until_due} days late` : v.days_until_due > 0 ? `in ${v.days_until_due} days` : ''}</span>
                      </td>
                      {isVet && <td><button type="button" className="button button-small button-quiet" onClick={() => addFromDue(v)}>Add to list</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      {isVet && (
        <form className="panel stack section" id="vaccinate" onSubmit={vaccinate}>
          <h2>Vaccinate animals</h2>
          <p className="muted">All the doses are saved together. If any animal cannot be vaccinated, none are saved.</p>
          <div className="form-grid">
            <Field label="Vaccine">
              <input value={form.vaccineName} onChange={(e) => chooseVaccine(e.target.value)} list="vaccine-options" required />
              <datalist id="vaccine-options">{[...intervals.keys()].map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Next dose after (days)"><input type="number" min="1" max="3650" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} required /></Field>
            <Field label="Date given"><input type="date" value={form.administeredDate} max={todayISO()} onChange={(e) => setForm({ ...form, administeredDate: e.target.value })} required /></Field>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ marginBottom: '0.3rem' }}>Animals ({form.cattleIds.length} chosen)</legend>
            <div className="checks">
              {(cattle.data?.cattle ?? []).map((c) => (
                <label key={c.cattle_id} className="check">
                  <input type="checkbox" checked={form.cattleIds.includes(c.cattle_id)} onChange={() => toggleAnimal(c.cattle_id)} />
                  <EarTag>{c.tag_number}</EarTag> {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Notice kind={message.kind}>{message.text}</Notice>
          <div className="form-actions"><button type="submit" className="button" disabled={busy}>{busy ? 'Saving…' : 'Record vaccinations'}</button></div>
        </form>
      )}
      {!isVet && <div className="section"><Notice kind={message.kind}>{message.text}</Notice></div>}

      <section className="section">
        <div className="section-head">
          <h2>History</h2>
          <Field label="Animal">
            <select value={historyCattle} onChange={(e) => setHistoryCattle(e.target.value)}>
              <option value="">All animals</option>
              {(cattle.data?.cattle ?? []).map((c) => <option key={c.cattle_id} value={c.cattle_id}>{c.tag_number} {c.name ?? ''}</option>)}
            </select>
          </Field>
        </div>
        {history.loading && !history.data ? <Loading what="vaccination history" /> : history.data && (
          history.data.vaccinations.length === 0 ? <Empty>No vaccinations recorded.</Empty> : (
            <div className="table-wrap">
              <table className="wide">
                <thead><tr><th>Given</th><th>Animal</th><th>Vaccine</th><th className="num">Interval</th><th>Next due</th><th>Given by</th></tr></thead>
                <tbody>
                  {history.data.vaccinations.map((v) => (
                    <tr key={v.vaccination_id}>
                      <td>{formatDate(v.administered_date)}</td>
                      <td><Link href={`/cattle/${v.cattle_id}`} className="row-link"><EarTag>{v.tag_number}</EarTag><span className="row-link-name">{v.cattle_name}</span></Link></td>
                      <td>{v.vaccine_name}</td>
                      <td className="num">{v.interval_days} days</td>
                      <td>{formatDate(v.next_due_date)}</td>
                      <td>{v.administered_by_name}</td>
                    </tr>
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
