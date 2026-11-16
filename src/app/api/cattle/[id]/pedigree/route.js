// GET /api/cattle/:id/pedigree?generations=N     (Owner, Vet)
// Ancestors of the animal from the fn_pedigree function (recursive CTE).
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, paramId, optionalInt, HttpError } from '@/lib/http.js';

export const GET = route(async (request, context) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  const id = await paramId(context);
  const generations = optionalInt(new URL(request.url).searchParams.get('generations'), 'generations', { min: 1, max: 10 }) ?? 10;

  const { rows } = await poolFor(user.role).query('SELECT * FROM fn_pedigree($1, $2)', [id, generations]);
  if (rows.length === 0) throw new HttpError(404, `Animal ${id} not found`);
  return json({ cattleId: id, generations, pedigree: rows });
});
