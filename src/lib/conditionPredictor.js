// Predicts a condition from vet notes by comparing meaning, not words.
// Each condition's typical signs (conditionProfiles.js) are embedded with
// the same model as the notes; pgvector ranks the conditions by cosine
// distance (<=>) to a note's stored vector, or to typed symptoms.
import { pool } from './db.js';
import { embedText, toPgVector } from './embeddings.js';
import { CONDITION_PROFILES } from './conditionProfiles.js';

let profilesPromise = null;

// Embed the condition descriptions once and reuse them
function profileVectors() {
  profilesPromise ??= (async () => {
    const vectors = [];
    for (const p of CONDITION_PROFILES) vectors.push(toPgVector(await embedText(p.signs)));
    return { names: CONDITION_PROFILES.map((p) => p.condition), vectors };
  })().catch((err) => { profilesPromise = null; throw err; });
  return profilesPromise;
}

// Top 3 conditions for a vector expression; $1 = names, $2 = vectors
const TOP_CONDITIONS = (target) => `
  SELECT json_agg(json_build_object('condition', t.condition, 'similarity', t.similarity)
                  ORDER BY t.similarity DESC)
  FROM (SELECT p.condition,
               round((1 - (${target} <=> p.vec::vector))::numeric, 3) AS similarity
        FROM unnest($1::text[], $2::text[]) AS p(condition, vec)
        ORDER BY ${target} <=> p.vec::vector
        LIMIT 3) t`;

// Prediction for every vet note that has a vector, newest first
export async function predictAllNotes(db = pool) {
  const { names, vectors } = await profileVectors();
  const { rows } = await db.query(
    `SELECT h.health_id, h.cattle_id, c.tag_number, c.name AS cattle_name, h.record_date,
            h.vet_notes, h.suspected_condition AS recorded_condition,
            (${TOP_CONDITIONS('ne.embedding')}) AS predictions
       FROM Health_Records h
       JOIN Note_Embeddings ne ON ne.health_id = h.health_id
       JOIN Cattle c           ON c.cattle_id  = h.cattle_id
      ORDER BY h.record_date DESC, h.health_id DESC`,
    [names, vectors],
  );
  return rows;
}

// Prediction for symptoms typed in now
export async function predictFromText(text, db = pool) {
  const { names, vectors } = await profileVectors();
  const query = toPgVector(await embedText(text));
  const { rows: [row] } = await db.query(`SELECT (${TOP_CONDITIONS('$3::vector')}) AS predictions`, [names, vectors, query]);
  return row.predictions;
}
