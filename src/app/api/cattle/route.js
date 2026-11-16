// /api/cattle
//   GET   (Owner, Vet, Farmhand)  list animals, optional filters:
//         ?status=Active|Sold|Deceased  ?sex=F|M  ?breed=  ?q= (tag or name)
//   POST  (Owner)  add an animal
//         { tagNumber, breed, sex, dateOfBirth, name?, status? }
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields } from '@/lib/http.js';

export const GET = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet', 'Farmhand']);
  const params = new URL(request.url).searchParams;
  const q = params.get('q')?.trim();

  const { rows } = await poolFor(user.role).query(
    `SELECT cattle_id, tag_number, name, breed, sex, date_of_birth, status,
            date_part('year', age(CURRENT_DATE, date_of_birth))::int AS age_years
       FROM Cattle
      WHERE ($1::varchar IS NULL OR status = $1)
        AND ($2::char    IS NULL OR sex = $2)
        AND ($3::varchar IS NULL OR breed = $3)
        AND ($4::text    IS NULL OR tag_number ILIKE '%' || $4 || '%' OR name ILIKE '%' || $4 || '%')
      ORDER BY cattle_id`,
    [params.get('status'), params.get('sex'), params.get('breed'), q || null],
  );
  return json({ cattle: rows });
});

export const POST = route(async (request) => {
  const user = await requireUser(request, ['Owner']);
  const body = await readJson(request);
  requireFields(body, ['tagNumber', 'breed', 'sex', 'dateOfBirth']);

  const { rows: [animal] } = await poolFor(user.role).query(
    `INSERT INTO Cattle (tag_number, name, breed, sex, date_of_birth, status)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'Active'))
     RETURNING *`,
    [body.tagNumber, body.name ?? null, body.breed, body.sex, body.dateOfBirth, body.status ?? null],
  );
  return json({ animal }, 201);
});
