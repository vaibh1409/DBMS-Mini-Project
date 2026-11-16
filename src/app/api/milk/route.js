// /api/milk
//   GET   (Owner, Vet, Farmhand)  ?days=N (default 30)  ?cattleId=
//         ?view=daily (default: totals per cow per day) | sessions (each reading)
//   POST  (Owner, Farmhand)  record a reading
//         { cattleId, session: 'Morning'|'Evening', litres, yieldDate? }
//         The database trigger only accepts active cows.
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields, optionalInt, toId, HttpError } from '@/lib/http.js';

export const GET = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet', 'Farmhand']);
  const params = new URL(request.url).searchParams;
  const days = optionalInt(params.get('days'), 'days', { min: 1, max: 365 }) ?? 30;
  const cattleId = params.get('cattleId') ? toId(params.get('cattleId'), 'cattleId') : null;
  const view = params.get('view') ?? 'daily';
  if (!['daily', 'sessions'].includes(view)) throw new HttpError(400, 'view must be daily or sessions');

  const db = poolFor(user.role);
  const { rows } = view === 'daily'
    ? await db.query(
        `SELECT cattle_id, tag_number, name, yield_date, total_litres, sessions_recorded
           FROM v_daily_milk_totals
          WHERE yield_date > CURRENT_DATE - $1::int
            AND ($2::int IS NULL OR cattle_id = $2)
          ORDER BY yield_date DESC, cattle_id`,
        [days, cattleId])
    : await db.query(
        `SELECT m.yield_id, m.cattle_id, c.tag_number, c.name, m.yield_date, m.session,
                m.litres, s.full_name AS recorded_by_name
           FROM Milk_Yield m
           JOIN Cattle c     ON c.cattle_id = m.cattle_id
           JOIN Farm_Staff s ON s.staff_id  = m.recorded_by
          WHERE m.yield_date > CURRENT_DATE - $1::int
            AND ($2::int IS NULL OR m.cattle_id = $2)
          ORDER BY m.yield_date DESC, m.cattle_id, m.session DESC`,
        [days, cattleId]);
  return json({ view, days, milk: rows });
});

export const POST = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Farmhand']);
  const body = await readJson(request);
  requireFields(body, ['cattleId', 'session', 'litres']);
  const litres = Number(body.litres);
  if (!Number.isFinite(litres)) throw new HttpError(400, 'litres must be a number');

  const { rows: [reading] } = await poolFor(user.role).query(
    `INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5)
     RETURNING *`,
    [toId(body.cattleId, 'cattleId'), body.yieldDate ?? null, body.session, litres, user.staffId],
  );
  return json({ reading }, 201);
});
