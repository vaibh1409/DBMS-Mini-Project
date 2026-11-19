// /api/notes/predictions        (Owner, Vet)
//   GET   predicted condition for every vet note that has a vector
//   POST  { text }  predicted condition for symptoms typed in
// Each answer lists the 3 closest conditions with their cosine similarity.
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields, HttpError } from '@/lib/http.js';
import { predictAllNotes, predictFromText } from '@/lib/conditionPredictor.js';

export const GET = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  return json({ notes: await predictAllNotes(poolFor(user.role)) });
});

export const POST = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  const body = await readJson(request);
  requireFields(body, ['text']);
  if (typeof body.text !== 'string' || body.text.trim().length < 3) {
    throw new HttpError(400, 'text must be at least 3 characters');
  }
  return json({ predictions: await predictFromText(body.text.trim(), poolFor(user.role)) });
});
