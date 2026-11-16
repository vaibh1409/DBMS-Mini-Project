// GET /api/auth/me
// Returns the signed-in user, or 401 if there is no valid session.
import { requireUser } from '@/lib/auth.js';
import { route, json } from '@/lib/http.js';

export const GET = route(async (request) => {
  const user = await requireUser(request);
  return json({ user });
});
