// Creates embeddings for vet notes.
//   node scripts/embed_notes.js        embeds notes that do not have one yet
//   node scripts/embed_notes.js --all  re-embeds every note
import 'dotenv/config';
import { pool } from '../src/lib/db.js';
import { embedHealthRecord } from '../src/lib/noteVectors.js';

const reembedAll = process.argv.includes('--all');

try {
  const { rows } = await pool.query(
    reembedAll
      ? 'SELECT health_id FROM Health_Records ORDER BY health_id'
      : `SELECT h.health_id
           FROM Health_Records h
           LEFT JOIN Note_Embeddings ne ON ne.health_id = h.health_id
          WHERE ne.health_id IS NULL
          ORDER BY h.health_id`,
  );

  if (rows.length === 0) {
    console.log('All vet notes already have embeddings.');
  } else {
    console.log(`Embedding ${rows.length} vet note(s) with all-MiniLM-L6-v2 ...`);
    for (const { health_id } of rows) {
      await embedHealthRecord(health_id);
      process.stdout.write('.');
    }
    process.stdout.write('\n');
  }

  const { rows: [summary] } = await pool.query(
    `SELECT (SELECT count(*) FROM Health_Records)  AS notes,
            (SELECT count(*) FROM Note_Embeddings) AS embeddings`,
  );
  console.log(`Done. ${summary.embeddings} of ${summary.notes} notes have embeddings.`);
} catch (err) {
  console.error('Embedding failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
