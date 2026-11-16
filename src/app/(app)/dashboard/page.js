'use client';
// Today's overview. Opens with what needs attention: milk drops and
// vaccinations due (Owner, Vet) and milk readings not yet recorded today.
import Link from 'next/link';
import { useUser } from '@/components/AppShell.js';
import { useApi } from '@/lib/apiClient.js';
import { EarTag, PageHeader, Notice, Loading, Badge, formatDate, todayISO, litres } from '@/components/ui.js';

export default function DashboardPage() {
  const user = useUser();
  const canSeeHealth = user.role !== 'Farmhand';
  const today = todayISO();

  const cattle = useApi('/api/cattle?status=Active');
  const milkWeek = useApi('/api/milk?days=7');
  const todaySessions = useApi('/api/milk?days=1&view=sessions');
  const anomalies = useApi(canSeeHealth ? '/api/milk/anomalies' : null);
  const due = useApi(canSeeHealth ? '/api/vaccinations?dueWithin=0' : null);
  const recent = useApi(canSeeHealth ? '/api/health-records' : null);

  const loading = cattle.loading || milkWeek.loading || todaySessions.loading || anomalies.loading || due.loading;
  const error = cattle.error || milkWeek.error || todaySessions.error || anomalies.error || due.error;

  // Cows in milk = cows with readings in the last 7 days
  const cowsInMilk = new Map();
  for (const day of milkWeek.data?.milk ?? []) cowsInMilk.set(day.cattle_id, day);
  const sessionsToday = (todaySessions.data?.milk ?? []).filter((s) => s.yield_date === today);
  const litresToday = sessionsToday.reduce((sum, s) => sum + Number(s.litres), 0);

  // Readings still to record today
  const missing = [];
  for (const cow of cowsInMilk.values()) {
    for (const session of ['Morning', 'Evening']) {
      if (!sessionsToday.some((s) => s.cattle_id === cow.cattle_id && s.session === session)) {
        missing.push({ ...cow, session });
      }
    }
  }

  const attention = (anomalies.data?.anomalies.length ?? 0) + (due.data?.vaccinations.length ?? 0) + missing.length;

  return (
    <>
      <PageHeader title="Today on the farm" description={`${formatDate(today)}. Signed in as ${user.role}.`} />
      <Notice kind="error">{error}</Notice>

      {!loading && !error && (
        <div className="figures">
          <div className="figure"><span className="figure-value">{cattle.data.cattle.length}</span><span className="figure-label">active animals</span></div>
          <div className="figure"><span className="figure-value">{cowsInMilk.size}</span><span className="figure-label">cows in milk</span></div>
          <div className="figure"><span className="figure-value">{litres(litresToday)}</span><span className="figure-label">milk recorded today</span></div>
          {canSeeHealth && <div className="figure"><span className="figure-value">{due.data.vaccinations.length}</span><span className="figure-label">vaccinations due</span></div>}
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Needs attention</h2>
          <span className="row">
            {canSeeHealth && <Link href="/vaccinations">Vaccinations</Link>}
            {user.role !== 'Vet' && <Link href="/milk">Record milk</Link>}
          </span>
        </div>
        {loading ? <Loading what="today's tasks" /> : !error && (
          attention === 0 ? <p className="empty">Nothing needs attention right now.</p> : (
            <ul className="attention">
              {anomalies.data?.anomalies.map((a) => (
                <li key={`a${a.cattle_id}`}>
                  <EarTag>{a.tag_number}</EarTag>
                  <span className="what">
                    <Link href={`/cattle/${a.cattle_id}`}>{a.name}</Link>{' '}
                    <span className="alert-text">milk down {Math.abs(Number(a.change_pct))}%</span> over the last 3 days
                    ({Number(a.recent_avg).toFixed(1)} L a day, usually {Number(a.baseline_avg).toFixed(1)} L).
                    {a.latest_condition && <> Latest exam: {a.latest_condition}, {formatDate(a.latest_exam_date)}.</>}
                  </span>
                </li>
              ))}
              {due.data?.vaccinations.map((v) => (
                <li key={`v${v.cattle_id}-${v.vaccine_name}`}>
                  <EarTag>{v.tag_number}</EarTag>
                  <span className="what">
                    <Link href={`/cattle/${v.cattle_id}`}>{v.name}</Link>: {v.vaccine_name} vaccination{' '}
                    {v.due_status === 'Overdue' ? <span className="alert-text">overdue by {-v.days_until_due} days</span> : 'due today'}.
                  </span>
                </li>
              ))}
              {missing.map((m) => (
                <li key={`m${m.cattle_id}-${m.session}`}>
                  <EarTag>{m.tag_number}</EarTag>
                  <span className="what">{m.name}: {m.session.toLowerCase()} milk reading not recorded yet.</span>
                </li>
              ))}
            </ul>
          )
        )}
      </section>

      {canSeeHealth && (
        <section className="section">
          <div className="section-head">
            <h2>Latest examinations</h2>
            <Link href="/health">All health records</Link>
          </div>
          {recent.loading ? <Loading what="examinations" /> : recent.data && (
            <div className="table-wrap">
              <table className="wide">
                <thead><tr><th>Date</th><th>Animal</th><th>Suspected condition</th><th>Severity</th><th>Vet</th></tr></thead>
                <tbody>
                  {recent.data.records.slice(0, 5).map((r) => (
                    <tr key={r.health_id}>
                      <td>{formatDate(r.record_date)}</td>
                      <td><Link href={`/cattle/${r.cattle_id}`} className="row-link"><EarTag>{r.tag_number}</EarTag><span className="row-link-name">{r.cattle_name}</span></Link></td>
                      <td>{r.suspected_condition ?? 'Routine check'}</td>
                      <td><Badge>{r.severity}</Badge></td>
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
