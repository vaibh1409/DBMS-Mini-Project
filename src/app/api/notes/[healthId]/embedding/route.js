// /api/notes/:healthId/embedding     (Owner, Vet)
// Read, create/update and delete the vector for one vet note.
//   GET     the embedding's metadata (dimensions, length, condition, date)
//   POST    embed the note now (creates it, or replaces it after an edit)
//   DELETE  remove the embedding (the health record is kept)
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, paramId, HttpError } from '@/lib/http.js';
import { getNoteEmbedding, embedHealthRecord, deleteNoteEmbedding } from '@/lib/noteVectors.js';

const ROLES = ['Owner', 'Vet'];

export const GET = route(async (request, context) => {
  const user = await requireUser(request, ROLES);
  const healthId = await paramId(context, 'healthId');
  const embedding = await getNoteEmbedding(healthId, poolFor(user.role));
  if (!embedding) throw new HttpError(404, `Health record ${healthId} has no embedding`);
  return json({ embedding });
});

export const POST = route(async (request, context) => {
  const user = await requireUser(request, ROLES);
  const healthId = await paramId(context, 'healthId');
  const db = poolFor(user.role);
  await embedHealthRecord(healthId, db);
  return json({ embedding: await getNoteEmbedding(healthId, db) }, 201);
});

export const DELETE = route(async (request, context) => {
  const user = await requireUser(request, ROLES);
  const healthId = await paramId(context, 'healthId');
  const deleted = await deleteNoteEmbedding(healthId, poolFor(user.role));
  if (!deleted) throw new HttpError(404, `Health record ${healthId} has no embedding`);
  return json({ deleted: healthId });
});
