-- =====================================================================
-- HerdSense | vector_queries.sql
-- Vector read / update / delete demonstrated in plain SQL, using the
-- embeddings already stored by `npm run embed`.
-- The update and delete examples run inside a transaction that is
-- rolled back, so this file can be run any number of times.
--
-- Searching with new free text needs the model, so that is done in
-- Node: `node scripts/vector_demo.js search "<symptoms>"`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- READ 1: what is stored (metadata, dimensions, vector length)
-- ---------------------------------------------------------------------
SELECT ne.embedding_id,
       ne.health_id,
       c.tag_number,
       ne.note_date,
       ne.suspected_condition,
       vector_dims(ne.embedding)                    AS dims,
       round(vector_norm(ne.embedding)::numeric, 4) AS norm
FROM Note_Embeddings ne
JOIN Cattle c ON c.cattle_id = ne.cattle_id
ORDER BY ne.health_id;

-- ---------------------------------------------------------------------
-- READ 2: similarity search. The 5 past notes most similar to note 1
-- (the latest mastitis case), using its stored vector as the query.
-- 1 - cosine distance (<=>) = cosine similarity.
-- ---------------------------------------------------------------------
SELECT ne.health_id,
       c.tag_number,
       ne.suspected_condition,
       round((1 - (ne.embedding <=> q.embedding))::numeric, 3) AS similarity,
       left(h.vet_notes, 60)                                   AS vet_notes
FROM Note_Embeddings ne
JOIN Health_Records h ON h.health_id = ne.health_id
JOIN Cattle c         ON c.cattle_id = ne.cattle_id,
     (SELECT embedding FROM Note_Embeddings WHERE health_id = 1) AS q
WHERE ne.health_id <> 1
ORDER BY ne.embedding <=> q.embedding
LIMIT 5;

-- ---------------------------------------------------------------------
-- READ 3: similarity search with a metadata filter
-- (only notes from the last 365 days)
-- ---------------------------------------------------------------------
SELECT ne.health_id,
       ne.note_date,
       ne.suspected_condition,
       round((1 - (ne.embedding <=> q.embedding))::numeric, 3) AS similarity
FROM Note_Embeddings ne,
     (SELECT embedding FROM Note_Embeddings WHERE health_id = 1) AS q
WHERE ne.health_id <> 1
  AND ne.note_date >= CURRENT_DATE - 365
ORDER BY ne.embedding <=> q.embedding
LIMIT 5;

-- ---------------------------------------------------------------------
-- READ 4: suggest likely conditions for note 1 from its 5 nearest
-- neighbours (count and average similarity per condition)
-- ---------------------------------------------------------------------
WITH neighbours AS (
    SELECT ne.suspected_condition,
           1 - (ne.embedding <=> q.embedding) AS similarity
    FROM Note_Embeddings ne,
         (SELECT embedding FROM Note_Embeddings WHERE health_id = 1) AS q
    WHERE ne.health_id <> 1
      AND ne.suspected_condition IS NOT NULL
    ORDER BY ne.embedding <=> q.embedding
    LIMIT 5
)
SELECT suspected_condition,
       count(*)                          AS matches,
       round(avg(similarity)::numeric, 3) AS avg_similarity
FROM neighbours
GROUP BY suspected_condition
ORDER BY matches DESC, avg_similarity DESC;

-- ---------------------------------------------------------------------
-- UPDATE and DELETE (rolled back at the end)
-- ---------------------------------------------------------------------
BEGIN;

-- UPDATE 1 (metadata): the lab confirms note 24 (routine check) was
-- early mastitis. Only the health record is updated; the trigger
-- trg_health_embedding_sync copies the new condition into the
-- embedding's metadata.
UPDATE Health_Records SET suspected_condition = 'Mastitis' WHERE health_id = 24;

SELECT h.health_id, h.suspected_condition AS record_condition, ne.suspected_condition AS embedding_condition
FROM Health_Records h JOIN Note_Embeddings ne ON ne.health_id = h.health_id
WHERE h.health_id = 24;

-- UPDATE 2 (vector): set a vector directly. Here note 24's embedding is
-- replaced with note 1's vector, so note 24 now matches note 1 exactly.
-- (Re-embedding new text needs the model: scripts/vector_demo.js update.)
UPDATE Note_Embeddings
   SET embedding = (SELECT embedding FROM Note_Embeddings WHERE health_id = 1)
 WHERE health_id = 24;

SELECT round((1 - (a.embedding <=> b.embedding))::numeric, 3) AS similarity_note_24_to_note_1
FROM Note_Embeddings a, Note_Embeddings b
WHERE a.health_id = 24 AND b.health_id = 1;

-- When the note text itself changes, the trigger deletes the old
-- embedding, because it no longer describes the text
UPDATE Health_Records SET vet_notes = 'Rechecked: udder normal, milk clear.' WHERE health_id = 24;
SELECT count(*) AS embeddings_for_note_24 FROM Note_Embeddings WHERE health_id = 24;

-- DELETE 1: remove one embedding directly (the health record stays)
DELETE FROM Note_Embeddings WHERE health_id = 23;
SELECT (SELECT count(*) FROM Health_Records  WHERE health_id = 23) AS record_left,
       (SELECT count(*) FROM Note_Embeddings WHERE health_id = 23) AS embedding_left;

-- DELETE 2: deleting a health record removes its embedding (ON DELETE CASCADE)
DELETE FROM Health_Records WHERE health_id = 22;
SELECT count(*) AS embeddings_for_note_22 FROM Note_Embeddings WHERE health_id = 22;

ROLLBACK;

-- ---------------------------------------------------------------------
-- The HNSW index is used for nearest-neighbour ordering.
-- SET enable_seqscan = off only forces the planner to show it on this
-- small table; with many rows it is chosen automatically.
-- ---------------------------------------------------------------------
SET enable_seqscan = off;
EXPLAIN
SELECT health_id
FROM Note_Embeddings
ORDER BY embedding <=> (SELECT embedding FROM Note_Embeddings WHERE health_id = 1)
LIMIT 5;
RESET enable_seqscan;
