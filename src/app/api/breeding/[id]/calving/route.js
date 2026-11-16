// POST /api/breeding/:id/calving     (Owner)
// { tagNumber, sex, breed, name?, dateOfBirth? }
// Records a birth with the sp_record_calving procedure: the calf is added
// and the pending breeding record is closed in one transaction.
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields, paramId } from '@/lib/http.js';

export const POST = route(async (request, context) => {
  const user = await requireUser(request, ['Owner']);
  const breedingId = await paramId(context);
  const body = await readJson(request);
  requireFields(body, ['tagNumber', 'sex', 'breed']);

  const db = poolFor(user.role);
  const { rows: [{ p_calf_id: calfId }] } = await db.query(
    'CALL sp_record_calving($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), NULL)',
    [breedingId, body.tagNumber, body.name ?? null, body.sex, body.breed, body.dateOfBirth ?? null],
  );
  const { rows: [calf] } = await db.query('SELECT * FROM Cattle WHERE cattle_id = $1', [calfId]);
  return json({ breedingId, calf }, 201);
});
