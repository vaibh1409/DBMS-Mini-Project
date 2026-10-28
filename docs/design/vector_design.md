# Vector Database Design (pgvector)

The vector component stores embeddings of the vet's free-text notes so that a new note can be matched against similar past cases by meaning, not just by keywords.

## What is converted into embeddings

The `vet_notes` text of each row in `Health_Records` (symptom and observation notes). Nothing else is embedded.

## Embedding model

| Item | Value |
|---|---|
| Model | all-MiniLM-L6-v2 (sentence-transformers) |
| Dimensions | 384 |
| Where it runs | Locally in Node.js through `scripts/embed_notes.js` and the API layer, so no external service or API key is needed |
| Normalisation | Vectors are normalised before storage |

## How vectors are stored

Vectors live in the `Note_Embeddings` table of the same PostgreSQL database, in a `vector(384)` column provided by the pgvector extension (`CREATE EXTENSION vector;` in `db/vector/setup_pgvector.sql`).

### Data model (document layout)

| Field | Type | Role |
|---|---|---|
| embedding_id | SERIAL, PK | Identifier |
| health_id | INT, FK, UNIQUE | Links to the source note in `Health_Records`; ON DELETE CASCADE |
| cattle_id | INT | Metadata, for filtering by animal |
| note_date | DATE | Metadata, for filtering and display |
| suspected_condition | VARCHAR(100) | Metadata, for filtering and for showing the likely condition of a match |
| embedding | vector(384) | The embedding of `vet_notes` |

Each note has exactly one embedding, enforced by the UNIQUE foreign key.

## Indexes

An HNSW index using the cosine operator class, for nearest-neighbour search:

```sql
CREATE INDEX idx_note_embeddings_hnsw
    ON Note_Embeddings USING hnsw (embedding vector_cosine_ops);
```

B-tree indexes on the metadata used as filters: `idx_note_embeddings_condition (suspected_condition)` and `idx_note_embeddings_cattle (cattle_id)`.

## Implementation files

| File | Purpose |
|---|---|
| `db/vector/setup_pgvector.sql` | Enables the pgvector extension |
| `db/vector/note_embeddings.sql` | Creates `Note_Embeddings` and its indexes |
| `db/vector/vector_queries.sql` | Read, similarity search, update and delete in plain SQL |
| `src/lib/embeddings.js` | Loads all-MiniLM-L6-v2 and turns text into a vector |
| `src/lib/noteVectors.js` | Create/update (upsert), read, search, delete and full-text fallback |
| `scripts/embed_notes.js` | Embeds every note that does not have an embedding yet (`--all` re-embeds) |
| `scripts/vector_demo.js` | Command-line demo of search, compare, read, update and delete |
| `docs/tests/vector_tests.js` | Automated tests for the vector operations |

## Similarity metric

Cosine distance (pgvector operator `<=>`). Similarity is reported as `1 - cosine_distance`, so 1.0 means identical meaning and values near 0 mean unrelated.

## Retrieval strategy

1. The new note text is embedded with the same model.
2. The nearest stored vectors are found with `ORDER BY embedding <=> :query_vector LIMIT k`.
3. Results are joined back to `Health_Records` and `Cattle` to show the matching note, animal, date, treatment and similarity score.
4. The suspected conditions of the top matches are tallied to suggest likely conditions, for example mastitis.
5. Metadata filters (`suspected_condition`, `cattle_id`, `note_date`) can narrow the search before ranking.

### Full-text search fallback

If the embedding step is unavailable, notes are searched with PostgreSQL full-text search on `Health_Records.vet_notes` (a `tsvector` GIN index, created in Phase 2).

## Read, update and delete operations

| Operation | What happens |
|---|---|
| Create | Saving a health record embeds `vet_notes` and inserts the `Note_Embeddings` row in the same transaction |
| Read | Similarity search as above, plus listing the embedding metadata of a note |
| Update | Editing `vet_notes` re-embeds the text and updates `embedding` and the metadata columns in one transaction. The trigger `trg_health_embedding_sync` keeps the vector store consistent even for edits made outside the app: it copies changed metadata to `Note_Embeddings` and deletes an embedding whose note text has changed |
| Delete | Deleting a health record removes its embedding through the ON DELETE CASCADE foreign key, and a single embedding can also be deleted directly |

## Why a vector store at all

Vet notes are unstructured text. Two notes can describe the same condition in different words ("swollen udder, clots in milk" and "hard quarter, abnormal secretion"), which keyword search misses. Embeddings capture meaning, so similar past cases can be found before lab results return.
