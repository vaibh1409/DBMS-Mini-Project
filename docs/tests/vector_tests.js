// HerdSense | Vector database tests (pgvector + all-MiniLM-L6-v2)
// Checks create, read (similarity search), update and delete on the
// vet-note embeddings, plus the constraints on the vector table.
//
// Run (after seeding and `npm run embed`):
//   node docs/tests/vector_tests.js
//
// The test creates one temporary health record and removes it at the end.
import 'dotenv/config';
import { pool } from '../../src/lib/db.js';
import {
  embedHealthRecord,
  getNoteEmbedding,
  searchSimilarNotes,
  suggestConditions,
  keywordSearchNotes,
  updateHealthNote,
  deleteNoteEmbedding,
} from '../../src/lib/noteVectors.js';

const results = [];
const record = (test, passed, detail = '') => results.push({ test, result: passed ? 'PASS' : 'FAIL', detail });

async function expectSqlError(test, code, sql, params = []) {
  try {
    await pool.query(sql, params);
    record(test, false, 'accepted');
  } catch (err) {
    record(test, err.code === code, `rejected (${err.code})`);
  }
}

let fixtureId = null;

try {
  // ---------------------------------------------------------------
  // Setup checks
  // ---------------------------------------------------------------
  const { rows: [ext] } = await pool.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
  record('V1 pgvector extension installed', Boolean(ext), ext ? `version ${ext.extversion}` : 'missing');

  const { rows: [counts] } = await pool.query(
    `SELECT (SELECT count(*) FROM Health_Records)::int  AS notes,
            (SELECT count(*) FROM Note_Embeddings)::int AS embeddings,
            (SELECT count(*) FROM Note_Embeddings WHERE vector_dims(embedding) <> 384)::int AS wrong_dims,
            (SELECT count(*) FROM Note_Embeddings WHERE abs(vector_norm(embedding) - 1) > 0.001)::int AS not_normalised`,
  );
  record('V2 every vet note has an embedding', counts.notes > 0 && counts.notes === counts.embeddings,
    `${counts.embeddings} of ${counts.notes}`);
  record('V3 all embeddings have 384 dimensions and length 1', counts.wrong_dims === 0 && counts.not_normalised === 0,
    `wrong dims ${counts.wrong_dims}, not normalised ${counts.not_normalised}`);

  // ---------------------------------------------------------------
  // READ: semantic search versus keyword search
  // ---------------------------------------------------------------
  const mastitisQuery = 'inflamed udder and lumpy discoloured milk';
  const keyword = await keywordSearchNotes(mastitisQuery);
  const semantic = await searchSimilarNotes(mastitisQuery, { k: 5 });
  record('V4 keyword search finds nothing for reworded mastitis symptoms', keyword.length === 0, `${keyword.length} rows`);
  record('V5 semantic search ranks mastitis notes first for the same query',
    semantic[0]?.suspected_condition === 'Mastitis' && semantic[1]?.suspected_condition === 'Mastitis',
    semantic.slice(0, 2).map((r) => `#${r.health_id} ${r.suspected_condition} ${r.similarity}`).join(', '));

  const suggestion = suggestConditions(semantic);
  record('V6 suggested condition is Mastitis', suggestion[0]?.condition === 'Mastitis',
    suggestion.slice(0, 2).map((s) => `${s.condition} x${s.matches}`).join(', '));

  const respiratory = await searchSimilarNotes('animal coughing with runny nose and breathing fast', { k: 3 });
  record('V7 respiratory symptoms match the respiratory case first',
    respiratory[0]?.suspected_condition === 'Respiratory Infection',
    `#${respiratory[0]?.health_id} ${respiratory[0]?.suspected_condition} ${respiratory[0]?.similarity}`);

  const sorted = semantic.every((r, i) => i === 0 || Number(semantic[i - 1].similarity) >= Number(r.similarity));
  record('V8 results are ordered by similarity, highest first', sorted);

  const filtered = await searchSimilarNotes('fever and weakness', { k: 10, condition: 'Tick Fever' });
  record('V9 metadata filter returns only the requested condition',
    filtered.length > 0 && filtered.every((r) => r.suspected_condition === 'Tick Fever'), `${filtered.length} rows`);

  // ---------------------------------------------------------------
  // CREATE: a new health record gets an embedding
  // ---------------------------------------------------------------
  const { rows: [fixture] } = await pool.query(
    `INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, suspected_condition, severity)
     VALUES (12, 2, CURRENT_DATE, 'Routine check, cow healthy and eating well.', NULL, 'Mild')
     RETURNING health_id`,
  );
  fixtureId = fixture.health_id;
  await embedHealthRecord(fixtureId);
  const created = await getNoteEmbedding(fixtureId);
  record('V10 create: new note is embedded with its metadata',
    created?.dimensions === 384 && created?.cattle_id === 12 && created?.suspected_condition === null,
    `health_id ${fixtureId}, dims ${created?.dimensions}`);

  // ---------------------------------------------------------------
  // UPDATE: editing the note re-embeds it and updates the metadata
  // ---------------------------------------------------------------
  const { rows: [before] } = await pool.query('SELECT embedding::text AS v FROM Note_Embeddings WHERE health_id = $1', [fixtureId]);
  const updated = await updateHealthNote(fixtureId, {
    vetNotes: 'Coughing and thick nasal discharge, breathing fast, temperature raised.',
    suspectedCondition: 'Respiratory Infection',
  });
  const { rows: [change] } = await pool.query(
    'SELECT round((embedding <=> $1::vector)::numeric, 3) AS distance FROM Note_Embeddings WHERE health_id = $2',
    [before.v, fixtureId],
  );
  record('V11 update: embedding changes when the note text changes', Number(change.distance) > 0.2,
    `cosine distance old vs new ${change.distance}`);
  record('V12 update: metadata follows the health record', updated.suspected_condition === 'Respiratory Infection');

  const afterUpdate = await searchSimilarNotes('animal coughing with runny nose and breathing fast', { k: 3 });
  record('V13 update: the edited note is now found by a matching search',
    afterUpdate.some((r) => r.health_id === fixtureId), afterUpdate.map((r) => `#${r.health_id}`).join(', '));

  // A failed update is rolled back completely (blank notes break a CHECK)
  const stateQuery = `SELECT h.vet_notes, ne.suspected_condition, ne.embedding::text AS v
                        FROM Health_Records h JOIN Note_Embeddings ne ON ne.health_id = h.health_id
                       WHERE h.health_id = $1`;
  const { rows: [beforeFail] } = await pool.query(stateQuery, [fixtureId]);
  let rolledBack = false;
  try {
    await updateHealthNote(fixtureId, { vetNotes: '   ', suspectedCondition: 'Bloat' });
  } catch (err) {
    const { rows: [afterFail] } = await pool.query(stateQuery, [fixtureId]);
    rolledBack = err.code === '23514'
      && afterFail.vet_notes === beforeFail.vet_notes
      && afterFail.suspected_condition === beforeFail.suspected_condition
      && afterFail.v === beforeFail.v;
  }
  record('V14 update: an invalid edit is rolled back (note and vector unchanged)', rolledBack);

  // ---------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------
  const deleted = await deleteNoteEmbedding(fixtureId);
  const { rows: [afterDelete] } = await pool.query(
    `SELECT (SELECT count(*) FROM Note_Embeddings WHERE health_id = $1)::int AS embeddings,
            (SELECT count(*) FROM Health_Records  WHERE health_id = $1)::int AS records`,
    [fixtureId],
  );
  record('V15 delete: embedding removed, health record kept',
    deleted && afterDelete.embeddings === 0 && afterDelete.records === 1);
  record('V16 delete: deleting a missing embedding reports nothing deleted', (await deleteNoteEmbedding(fixtureId)) === false);

  await embedHealthRecord(fixtureId);
  await pool.query('DELETE FROM Health_Records WHERE health_id = $1', [fixtureId]);
  const { rows: [cascade] } = await pool.query('SELECT count(*)::int AS n FROM Note_Embeddings WHERE health_id = $1', [fixtureId]);
  record('V17 delete: removing the health record removes its embedding (CASCADE)', cascade.n === 0);
  fixtureId = null;

  // ---------------------------------------------------------------
  // Constraints on the vector table
  // ---------------------------------------------------------------
  const zeroVector = `[${new Array(384).fill(0.01).join(',')}]`;
  await expectSqlError('V18 second embedding for the same note rejected (UNIQUE)', '23505',
    `INSERT INTO Note_Embeddings (health_id, cattle_id, note_date, embedding) VALUES (1, 10, CURRENT_DATE, $1)`, [zeroVector]);
  await expectSqlError('V19 embedding for a missing note rejected (foreign key)', '23503',
    `INSERT INTO Note_Embeddings (health_id, cattle_id, note_date, embedding) VALUES (999999, 10, CURRENT_DATE, $1)`, [zeroVector]);
  await expectSqlError('V20 vector with the wrong number of dimensions rejected', '22000',
    `INSERT INTO Note_Embeddings (health_id, cattle_id, note_date, embedding) VALUES (2, 11, CURRENT_DATE, '[1,2,3]')`);
} catch (err) {
  record('Unexpected error', false, err.message);
} finally {
  if (fixtureId !== null) {
    await pool.query('DELETE FROM Health_Records WHERE health_id = $1', [fixtureId]);
  }
  await pool.end();
}

console.table(results);
const passed = results.filter((r) => r.result === 'PASS').length;
console.log(`passed ${passed} / ${results.length}`);
if (passed !== results.length) process.exitCode = 1;
