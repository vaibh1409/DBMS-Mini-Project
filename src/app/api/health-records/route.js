// /api/health-records          (Owner, Vet)
//   GET   list examinations, optional filters: ?cattleId= &condition= &severity=
//   POST  add an examination and embed its note in the same transaction
//         { cattleId, vetNotes, severity, suspectedCondition?, treatment?,
//           recordDate?, vetId? }  (a Vet is recorded as the examining vet;
//           the Owner must give vetId)
import { requireUser } from '@/lib/auth.js';
import { poolFor, withTransaction } from '@/lib/db.js';
import { route, json, readJson, requireFields, toId, HttpError } from '@/lib/http.js';
import { embedHealthRecord, getNoteEmbedding } from '@/lib/noteVectors.js';

const ROLES = ['Owner', 'Vet'];

export const GET = route(async (request) => {
  const user = await requireUser(request, ROLES);
  const params = new URL(request.url).searchParams;
  const cattleId = params.get('cattleId') ? toId(params.get('cattleId'), 'cattleId') : null;

  const { rows } = await poolFor(user.role).query(
    `SELECT h.health_id, h.cattle_id, c.tag_number, c.name AS cattle_name,
            h.vet_id, s.full_name AS vet_name, h.record_date, h.vet_notes,
            h.suspected_condition, h.treatment, h.severity,
            (ne.health_id IS NOT NULL) AS has_embedding
       FROM Health_Records h
       JOIN Cattle c     ON c.cattle_id = h.cattle_id
       JOIN Farm_Staff s ON s.staff_id  = h.vet_id
       LEFT JOIN Note_Embeddings ne ON ne.health_id = h.health_id
      WHERE ($1::int     IS NULL OR h.cattle_id = $1)
        AND ($2::varchar IS NULL OR h.suspected_condition = $2)
        AND ($3::varchar IS NULL OR h.severity = $3)
      ORDER BY h.record_date DESC, h.health_id DESC`,
    [cattleId, params.get('condition'), params.get('severity')],
  );
  return json({ records: rows });
});

export const POST = route(async (request) => {
  const user = await requireUser(request, ROLES);
  const body = await readJson(request);
  requireFields(body, ['cattleId', 'vetNotes', 'severity']);

  let vetId = user.staffId;
  if (user.role === 'Owner') {
    if (body.vetId === undefined) throw new HttpError(400, 'vetId is required when the Owner adds a record');
    vetId = toId(body.vetId, 'vetId');
  }

  // Insert the record and its embedding together: both are saved or neither is
  const result = await withTransaction(async (client) => {
    const { rows: [record] } = await client.query(
      `INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, suspected_condition, treatment, severity)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7)
       RETURNING *`,
      [toId(body.cattleId, 'cattleId'), vetId, body.recordDate ?? null, body.vetNotes,
       body.suspectedCondition ?? null, body.treatment ?? null, body.severity],
    );
    await embedHealthRecord(record.health_id, client);
    const embedding = await getNoteEmbedding(record.health_id, client);
    return { record, embedding };
  }, poolFor(user.role));

  return json(result, 201);
});
