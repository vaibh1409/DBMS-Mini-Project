// /api/vaccinations
//   GET   (Owner, Vet)  ?dueWithin=N  doses due within N days (0 = due or
//                       overdue) from fn_vaccinations_due;
//                       otherwise the dose history, optional ?cattleId=
//   POST  (Vet)         record one vaccine for several animals in one
//                       transaction with the sp_vaccinate_herd procedure
//                       { vaccineName, intervalDays, cattleIds: [..],
//                         administeredDate? }
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields, optionalInt, toId, HttpError } from '@/lib/http.js';

export const GET = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  const params = new URL(request.url).searchParams;
  const db = poolFor(user.role);

  if (params.has('dueWithin')) {
    const days = optionalInt(params.get('dueWithin'), 'dueWithin', { min: 0, max: 365 }) ?? 0;
    const { rows } = await db.query('SELECT * FROM fn_vaccinations_due($1)', [days]);
    return json({ dueWithinDays: days, vaccinations: rows });
  }

  const cattleId = params.get('cattleId') ? toId(params.get('cattleId'), 'cattleId') : null;
  const { rows } = await db.query(
    `SELECT v.vaccination_id, v.cattle_id, c.tag_number, c.name AS cattle_name,
            v.vaccine_name, v.administered_date, v.interval_days, v.next_due_date,
            s.full_name AS administered_by_name
       FROM Vaccinations v
       JOIN Cattle c     ON c.cattle_id = v.cattle_id
       JOIN Farm_Staff s ON s.staff_id  = v.administered_by
      WHERE ($1::int IS NULL OR v.cattle_id = $1)
      ORDER BY v.administered_date DESC, v.vaccination_id DESC`,
    [cattleId],
  );
  return json({ vaccinations: rows });
});

export const POST = route(async (request) => {
  const user = await requireUser(request, ['Vet']);
  const body = await readJson(request);
  requireFields(body, ['vaccineName', 'intervalDays', 'cattleIds']);
  if (!Array.isArray(body.cattleIds) || body.cattleIds.length === 0) {
    throw new HttpError(400, 'cattleIds must be a non-empty list');
  }
  const cattleIds = body.cattleIds.map((id) => toId(id, 'cattleIds'));
  const intervalDays = optionalInt(body.intervalDays, 'intervalDays', { min: 1, max: 3650 });

  await poolFor(user.role).query(
    'CALL sp_vaccinate_herd($1, $2, $3, $4::int[], COALESCE($5::date, CURRENT_DATE))',
    [body.vaccineName, intervalDays, user.staffId, cattleIds, body.administeredDate ?? null],
  );
  return json({ recorded: cattleIds.length, vaccineName: body.vaccineName, cattleIds }, 201);
});
