# Database Choice and Justification

The database technology is chosen for each type of data in HerdSense.

## Structured records: PostgreSQL (SQL)

Cattle, staff, breeding, health, vaccination and milk-yield data are structured, interrelated and must stay consistent.

| Need | How PostgreSQL meets it |
|---|---|
| Strict referential integrity between animals, parents, calves, staff and records | Primary keys, foreign keys with ON DELETE rules, CHECK, UNIQUE and NOT NULL constraints |
| Pedigree tracing across generations | Recursive CTEs over `Breeding_Records` |
| Vaccination-due tracking and yield-anomaly detection | Triggers, stored procedures and functions |
| Multi-step updates that must succeed or fail together | ACID transactions |
| Role-based access at the database level | PostgreSQL roles and GRANTs |
| Reporting across tables | JOIN, GROUP BY, HAVING, aggregates, views |

## Free-text vet notes: vector database (pgvector)

Vet notes are unstructured text, and the useful question is "which past cases sound like this one?". That is a similarity question, which a relational table with exact matching cannot answer. Embeddings with cosine similarity answer it directly.

## Why pgvector rather than a separate vector database

- **One database:** the vectors live in the same PostgreSQL instance as the records they describe, so a note and its embedding are saved, updated and deleted in one transaction, and a foreign key with ON DELETE CASCADE keeps them consistent. A separate store would need extra code to keep the two in sync.
- **Simple setup:** one service to install and run, which suits a small-to-mid dairy farm and a reproducible demo.
- **Enough scale:** a farm produces thousands of notes, not millions, so an HNSW index inside PostgreSQL is fast enough.
- **Trade-off:** a dedicated vector database such as Qdrant scales further and has more specialised features, which this project does not need.

## Why not a document database

The data is highly relational (animals, parents, staff, records) and benefits from joins, constraints and transactions. A document store would give up those guarantees without a matching benefit for this project.
