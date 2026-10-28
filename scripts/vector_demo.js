// Command-line demo of the vector operations on vet notes.
//
//   node scripts/vector_demo.js search  "<symptoms>" [condition]
//   node scripts/vector_demo.js compare "<symptoms>"
//   node scripts/vector_demo.js read    <health_id>
//   node scripts/vector_demo.js update  <health_id> "<new vet notes>" ["<suspected condition>"]
//   node scripts/vector_demo.js delete  <health_id>
import 'dotenv/config';
import { pool } from '../src/lib/db.js';
import {
  searchSimilarNotes,
  suggestConditions,
  keywordSearchNotes,
  getNoteEmbedding,
  updateHealthNote,
  deleteNoteEmbedding,
} from '../src/lib/noteVectors.js';

const [command, ...args] = process.argv.slice(2);

const short = (text, n = 70) => (text.length > n ? `${text.slice(0, n - 3)}...` : text);
const showNotes = (rows, scoreKey) =>
  console.table(rows.map((r) => ({
    health_id: r.health_id,
    tag: r.tag_number,
    date: r.note_date,
    condition: r.suspected_condition ?? '-',
    [scoreKey]: Number(r[scoreKey]),
    notes: short(r.vet_notes),
  })));

async function main() {
  switch (command) {
    case 'search': {
      const [text, condition] = args;
      if (!text) throw new Error('Usage: search "<symptoms>" [condition]');
      const matches = await searchSimilarNotes(text, { k: 5, condition: condition ?? null });
      console.log(`\nMost similar past notes to: "${text}"${condition ? ` (condition = ${condition})` : ''}`);
      showNotes(matches, 'similarity');
      console.log('Likely conditions:');
      console.table(suggestConditions(matches));
      break;
    }
    case 'compare': {
      const [text] = args;
      if (!text) throw new Error('Usage: compare "<symptoms>"');
      console.log(`\nQuery: "${text}"\n\nKeyword (full-text) search:`);
      const keyword = await keywordSearchNotes(text);
      if (keyword.length === 0) console.log('  no matches');
      else showNotes(keyword, 'rank');
      console.log('Semantic (vector) search:');
      showNotes(await searchSimilarNotes(text), 'similarity');
      break;
    }
    case 'read': {
      const row = await getNoteEmbedding(Number(args[0]));
      if (!row) console.log(`No embedding for health record ${args[0]}`);
      else console.table([{ ...row, vet_notes: short(row.vet_notes) }]);
      break;
    }
    case 'update': {
      const [id, vetNotes, suspectedCondition] = args;
      if (!id || !vetNotes) throw new Error('Usage: update <health_id> "<new vet notes>" ["<suspected condition>"]');
      const row = await updateHealthNote(Number(id), { vetNotes, ...(suspectedCondition !== undefined && { suspectedCondition }) });
      console.log(`Updated health record ${id} and re-embedded its note:`);
      console.table([{ ...row, vet_notes: short(row.vet_notes) }]);
      break;
    }
    case 'delete': {
      const deleted = await deleteNoteEmbedding(Number(args[0]));
      console.log(deleted ? `Deleted the embedding of health record ${args[0]} (the health record itself is kept).`
                          : `No embedding found for health record ${args[0]}.`);
      break;
    }
    default:
      console.log('Commands: search, compare, read, update, delete (see the top of scripts/vector_demo.js)');
  }
}

try {
  await main();
} catch (err) {
  console.error('Error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
