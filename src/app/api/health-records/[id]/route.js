// /api/health-records/:id      (Owner, Vet)
//   GET     one examination with its embedding metadata
//   PATCH   edit it { vetNotes?, suspectedCondition?, treatment?, severity?,
//           recordDate? } and re-embed the note in the same transaction
//   DELETE  delete it (its embedding is removed by ON DELETE CASCADE)
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, paramId, HttpError } from '@/lib/http.js';
import { getNoteEmbedding, updateHealthNote } from '@/lib/noteVectors.js';

const ROLES = ['Owner', 'Vet'];

export const GET = route(async (request, context) => {
  const user = await requireUser(request, ROLES);
  const id = await paramId(context);
  const db = poolFor(user.role);

  const { rows: [record] } = await db.query(
    `SELECT h.*, c.tag_number, c.name AS cattle_name, s.full_name AS vet_name
       FROM Health_Records h
       JOIN Cattle c     ON c.cattle_id = h.cattle_id
       JOIN Farm_Staff s ON s.staff_id  = h.vet_id
      WHERE h.health_id = $1`,
    [id],
  );
  if (!record) throw new HttpError(404, `Health record ${id} not found`);

  return json({ record, embedding: await getNoteEmbedding(id, db) });
});

export const PATCH = route(async (request, context) => {
  const user = await requireUser(request, ROLES);
  const id = await paramId(context);
  const body = await readJson(request);

  const embedding = await updateHealthNote(id, {
    vetNotes: body.vetNotes,
    suspectedCondition: body.suspectedCondition,
    treatment: body.treatment,
    severity: body.severity,
    recordDate: body.recordDate,
  }, poolFor(user.role));

  return json({ embedding });
});

export const DELETE = route(async (request, context) => {
  const user = await requireUser(request, ROLES);
  const id = await paramId(context);

  const { rowCount } = await poolFor(user.role).query('DELETE FROM Health_Records WHERE health_id = $1', [id]);
  if (rowCount === 0) throw new HttpError(404, `Health record ${id} not found`);
  return json({ deleted: id });
});
