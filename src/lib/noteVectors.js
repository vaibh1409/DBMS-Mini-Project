// Vector operations on vet-note embeddings (pgvector):
// create/update (upsert), read, similarity search, delete,
// plus the full-text search fallback.
import { pool, withTransaction } from './db.js';
import { embedText, toPgVector } from './embeddings.js';

// ---------------------------------------------------------------------
// CREATE / UPDATE
// Embeds one health record's vet_notes and stores it with its metadata.
// Inserts a new row, or replaces the existing one for that note.
// ---------------------------------------------------------------------
export async function embedHealthRecord(healthId, db = pool) {
  const { rows } = await db.query(
    `SELECT health_id, cattle_id, record_date, vet_notes, suspected_condition
       FROM Health_Records
      WHERE health_id = $1`,
    [healthId],
  );
  if (rows.length === 0) {
    throw new Error(`Health record ${healthId} not found`);
  }
  const note = rows[0];
  const vector = await embedText(note.vet_notes);

  await db.query(
    `INSERT INTO Note_Embeddings (health_id, cattle_id, note_date, suspected_condition, embedding)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (health_id) DO UPDATE
        SET cattle_id           = EXCLUDED.cattle_id,
            note_date           = EXCLUDED.note_date,
            suspected_condition = EXCLUDED.suspected_condition,
            embedding           = EXCLUDED.embedding`,
    [note.health_id, note.cattle_id, note.record_date, note.suspected_condition, toPgVector(vector)],
  );
  return note.health_id;
}

// ---------------------------------------------------------------------
// READ: one note's embedding and metadata
// ---------------------------------------------------------------------
export async function getNoteEmbedding(healthId, db = pool) {
  const { rows } = await db.query(
    `SELECT ne.embedding_id,
            ne.health_id,
            ne.cattle_id,
            c.tag_number,
            ne.note_date,
            ne.suspected_condition,
            vector_dims(ne.embedding)                 AS dimensions,
            round(vector_norm(ne.embedding)::numeric, 4) AS norm,
            h.vet_notes
       FROM Note_Embeddings ne
       JOIN Health_Records h ON h.health_id = ne.health_id
       JOIN Cattle c         ON c.cattle_id = ne.cattle_id
      WHERE ne.health_id = $1`,
    [healthId],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------
// READ: semantic similarity search
// Embeds the query text and returns the k nearest notes by cosine
// distance, optionally filtered by metadata.
// ---------------------------------------------------------------------
export async function searchSimilarNotes(
  text,
  { k = 5, condition = null, cattleId = null, excludeHealthId = null } = {},
  db = pool,
) {
  const queryVector = toPgVector(await embedText(text));
  const { rows } = await db.query(
    `SELECT ne.health_id,
            ne.cattle_id,
            c.tag_number,
            c.name,
            ne.note_date,
            ne.suspected_condition,
            h.vet_notes,
            h.treatment,
            round((1 - (ne.embedding <=> $1::vector))::numeric, 3) AS similarity
       FROM Note_Embeddings ne
       JOIN Health_Records h ON h.health_id = ne.health_id
       JOIN Cattle c         ON c.cattle_id = ne.cattle_id
      WHERE ($2::varchar IS NULL OR ne.suspected_condition = $2)
        AND ($3::int     IS NULL OR ne.cattle_id = $3)
        AND ($4::int     IS NULL OR ne.health_id <> $4)
      ORDER BY ne.embedding <=> $1::vector
      LIMIT $5`,
    [queryVector, condition, cattleId, excludeHealthId, k],
  );
  return rows;
}

// Tallies the suspected conditions of the nearest notes to suggest the
// most likely conditions for a new note.
export function suggestConditions(matches) {
  const tally = new Map();
  for (const m of matches) {
    if (!m.suspected_condition) continue;
    const entry = tally.get(m.suspected_condition) ?? { condition: m.suspected_condition, matches: 0, totalSimilarity: 0 };
    entry.matches += 1;
    entry.totalSimilarity += Number(m.similarity);
    tally.set(m.suspected_condition, entry);
  }
  return [...tally.values()]
    .map((e) => ({ condition: e.condition, matches: e.matches, avg_similarity: Number((e.totalSimilarity / e.matches).toFixed(3)) }))
    .sort((a, b) => b.matches - a.matches || b.avg_similarity - a.avg_similarity);
}

// ---------------------------------------------------------------------
// READ (fallback): PostgreSQL full-text search on vet_notes.
// Uses the GIN index idx_health_notes_fts.
// ---------------------------------------------------------------------
export async function keywordSearchNotes(text, { k = 5 } = {}, db = pool) {
  const { rows } = await db.query(
    `SELECT h.health_id,
            h.cattle_id,
            c.tag_number,
            c.name,
            h.record_date AS note_date,
            h.suspected_condition,
            h.vet_notes,
            h.treatment,
            round(ts_rank(to_tsvector('english', h.vet_notes), q)::numeric, 3) AS rank
       FROM Health_Records h
       JOIN Cattle c ON c.cattle_id = h.cattle_id,
            plainto_tsquery('english', $1) AS q
      WHERE to_tsvector('english', h.vet_notes) @@ q
      ORDER BY rank DESC
      LIMIT $2`,
    [text, k],
  );
  return rows;
}

// ---------------------------------------------------------------------
// UPDATE: edit a vet note and/or its suspected condition, then
// re-embed it, all in one transaction so the note and its vector
// never disagree.
// ---------------------------------------------------------------------
export async function updateHealthNote(healthId, { vetNotes, suspectedCondition }) {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE Health_Records
          SET vet_notes           = COALESCE($2, vet_notes),
              suspected_condition = CASE WHEN $3::boolean THEN $4 ELSE suspected_condition END
        WHERE health_id = $1`,
      [healthId, vetNotes ?? null, suspectedCondition !== undefined, suspectedCondition ?? null],
    );
    if (rowCount === 0) {
      throw new Error(`Health record ${healthId} not found`);
    }
    await embedHealthRecord(healthId, client);
    return getNoteEmbedding(healthId, client);
  });
}

// ---------------------------------------------------------------------
// DELETE: remove one note's embedding (the health record stays).
// Deleting the health record itself also removes the embedding through
// ON DELETE CASCADE.
// ---------------------------------------------------------------------
export async function deleteNoteEmbedding(healthId, db = pool) {
  const { rowCount } = await db.query('DELETE FROM Note_Embeddings WHERE health_id = $1', [healthId]);
  return rowCount === 1;
}
