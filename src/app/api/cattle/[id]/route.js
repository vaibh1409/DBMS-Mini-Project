// /api/cattle/:id
//   GET     (Owner, Vet, Farmhand)  one animal; Owner and Vet also get
//           its parents and calves (Farmhands cannot read breeding records)
//   PATCH   (Owner)  { tagNumber?, name?, breed?, sex?, dateOfBirth?, status? }
//   DELETE  (Owner)  refused by the database if the animal is a parent
//           in a breeding record (ON DELETE RESTRICT)
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, paramId, HttpError } from '@/lib/http.js';

const EDITABLE = {
  tagNumber: 'tag_number',
  name: 'name',
  breed: 'breed',
  sex: 'sex',
  dateOfBirth: 'date_of_birth',
  status: 'status',
};

export const GET = route(async (request, context) => {
  const user = await requireUser(request, ['Owner', 'Vet', 'Farmhand']);
  const id = await paramId(context);
  const db = poolFor(user.role);

  const { rows: [animal] } = await db.query('SELECT * FROM Cattle WHERE cattle_id = $1', [id]);
  if (!animal) throw new HttpError(404, `Animal ${id} not found`);
  if (user.role === 'Farmhand') return json({ animal });

  const { rows: [parents] } = await db.query(
    `SELECT dam.cattle_id AS dam_id, dam.name AS dam_name,
            sire.cattle_id AS sire_id, sire.name AS sire_name
       FROM Breeding_Records b
       JOIN Cattle dam  ON dam.cattle_id  = b.dam_id
       JOIN Cattle sire ON sire.cattle_id = b.sire_id
      WHERE b.calf_id = $1`,
    [id],
  );
  const { rows: calves } = await db.query(
    `SELECT calf.cattle_id, calf.tag_number, calf.name, calf.sex, calf.date_of_birth
       FROM Breeding_Records b
       JOIN Cattle calf ON calf.cattle_id = b.calf_id
      WHERE $1 IN (b.dam_id, b.sire_id)
      ORDER BY calf.date_of_birth`,
    [id],
  );
  return json({ animal, parents: parents ?? null, calves });
});

export const PATCH = route(async (request, context) => {
  const user = await requireUser(request, ['Owner']);
  const id = await paramId(context);
  const body = await readJson(request);

  const values = [id];
  const sets = [];
  for (const [field, column] of Object.entries(EDITABLE)) {
    if (body[field] !== undefined) {
      values.push(body[field]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) throw new HttpError(400, `Nothing to change. Editable fields: ${Object.keys(EDITABLE).join(', ')}`);

  const { rows: [animal] } = await poolFor(user.role).query(
    `UPDATE Cattle SET ${sets.join(', ')} WHERE cattle_id = $1 RETURNING *`,
    values,
  );
  if (!animal) throw new HttpError(404, `Animal ${id} not found`);
  return json({ animal });
});

export const DELETE = route(async (request, context) => {
  const user = await requireUser(request, ['Owner']);
  const id = await paramId(context);

  const { rowCount } = await poolFor(user.role).query('DELETE FROM Cattle WHERE cattle_id = $1', [id]);
  if (rowCount === 0) throw new HttpError(404, `Animal ${id} not found`);
  return json({ deleted: id });
});
