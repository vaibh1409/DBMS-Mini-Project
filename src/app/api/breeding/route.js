// /api/breeding
//   GET   (Owner, Vet)  breeding records with dam, sire and calf names,
//         optional ?outcome=Pending|Calved|Failed  ?damId=
//   POST  (Owner)  record a breeding { damId, sireId, breedingDate, method }
//         The database trigger checks the dam is female and the sire male.
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields, toId } from '@/lib/http.js';

export const GET = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  const params = new URL(request.url).searchParams;
  const damId = params.get('damId') ? toId(params.get('damId'), 'damId') : null;

  const { rows } = await poolFor(user.role).query(
    `SELECT b.breeding_id, b.breeding_date, b.method, b.outcome,
            b.dam_id,  dam.name  AS dam_name,
            b.sire_id, sire.name AS sire_name,
            b.calf_id, calf.name AS calf_name, calf.date_of_birth AS calf_date_of_birth
       FROM Breeding_Records b
       JOIN Cattle dam       ON dam.cattle_id  = b.dam_id
       JOIN Cattle sire      ON sire.cattle_id = b.sire_id
       LEFT JOIN Cattle calf ON calf.cattle_id = b.calf_id
      WHERE ($1::varchar IS NULL OR b.outcome = $1)
        AND ($2::int     IS NULL OR b.dam_id = $2)
      ORDER BY b.breeding_date DESC`,
    [params.get('outcome'), damId],
  );
  return json({ breeding: rows });
});

export const POST = route(async (request) => {
  const user = await requireUser(request, ['Owner']);
  const body = await readJson(request);
  requireFields(body, ['damId', 'sireId', 'breedingDate', 'method']);

  const { rows: [record] } = await poolFor(user.role).query(
    `INSERT INTO Breeding_Records (dam_id, sire_id, breeding_date, method, recorded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [toId(body.damId, 'damId'), toId(body.sireId, 'sireId'), body.breedingDate, body.method, user.staffId],
  );
  return json({ breeding: record }, 201);
});
