// POST /api/notes/search       (Owner, Vet)
// { text, mode?: 'semantic' | 'keyword' | 'both', k?: 1-20,
//   condition?, cattleId? }
//   semantic: vector similarity search on the vet-note embeddings, plus
//             the likely conditions of the nearest notes
//   keyword:  PostgreSQL full-text search (the fallback)
//   both:     both result lists, to compare them
// If semantic search fails because the embedding model cannot load,
// keyword results are returned instead with fallback: true.
import { requireUser } from '@/lib/auth.js';
import { poolFor } from '@/lib/db.js';
import { route, json, readJson, requireFields, optionalInt, toId, HttpError } from '@/lib/http.js';
import { searchSimilarNotes, suggestConditions, keywordSearchNotes } from '@/lib/noteVectors.js';

const MODES = ['semantic', 'keyword', 'both'];

export const POST = route(async (request) => {
  const user = await requireUser(request, ['Owner', 'Vet']);
  const body = await readJson(request);
  requireFields(body, ['text']);
  if (typeof body.text !== 'string' || body.text.trim().length < 3) {
    throw new HttpError(400, 'text must be at least 3 characters');
  }
  const mode = body.mode ?? 'semantic';
  if (!MODES.includes(mode)) throw new HttpError(400, `mode must be one of: ${MODES.join(', ')}`);

  const k = optionalInt(body.k, 'k', { min: 1, max: 20 }) ?? 5;
  const filters = {
    k,
    condition: body.condition || null,
    cattleId: body.cattleId ? toId(body.cattleId, 'cattleId') : null,
  };
  const db = poolFor(user.role);
  const result = { mode };

  if (mode === 'keyword' || mode === 'both') {
    result.keyword = await keywordSearchNotes(body.text, { k }, db);
  }
  if (mode === 'semantic' || mode === 'both') {
    try {
      result.semantic = await searchSimilarNotes(body.text, filters, db);
      result.suggestedConditions = suggestConditions(result.semantic);
    } catch (err) {
      if (err.code) throw err;   // a database error, not the model: report it
      console.error('Semantic search unavailable, using keyword search:', err.message);
      result.fallback = true;
      result.keyword ??= await keywordSearchNotes(body.text, { k }, db);
    }
  }
  return json(result);
});
