// GET /api/milk/anomalies?recentDays=3&dropPct=20     (Owner, Vet)
// Cows whose recent milk yield dropped sharply, from the
// fn_yield_anomalies function, with each cow's latest health record.
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, optionalInt } from '@/lib/http.js';

export const GET = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  const params = new URL(request.url).searchParams;
  const recentDays = optionalInt(params.get('recentDays'), 'recentDays', { min: 1, max: 14 }) ?? 3;
  const dropPct = optionalInt(params.get('dropPct'), 'dropPct', { min: 1, max: 99 }) ?? 20;

  const { rows } = await poolFor(user.role).query('SELECT * FROM fn_yield_anomalies($1, $2)', [recentDays, dropPct]);
  return json({ recentDays, dropPct, anomalies: rows });
});
