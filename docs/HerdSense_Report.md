# HerdSense: Livestock Health & Breeding Record Management for Dairy Farms

**Project Report** · DBMS Experiential Learning – Level 3 · PES University, Department of Computer Science and Engineering · Aug–Dec 2026

| Member | SRN | Responsibilities |
|--------|-----|------------------|
| Vaibhav Raj Warrier | PES1UG24CS640 | Cattle, breeding and pedigree, milk yield: tables, queries, triggers, procedures, API routes and pages |
| Varun Rao | PES1UG24CS520 | Staff, health records, vaccinations, vector search, authentication and roles: tables, queries, triggers, procedures, API routes and pages |

Repository: https://github.com/vaibh1409/DBMS-Mini-Project

## Contents

1. Objectives
2. Functional requirements
3. ER diagram
4. Relational schema
5. Database choice and justification
6. Data dictionary
7. SQL and vector database implementation
8. Important queries
9. System architecture
10. Application screenshots
11. Testing results
12. Conclusion

---

## 1. Objectives

Small and mid-sized dairy farms keep cattle records in notebooks or spreadsheets. Health, vaccination, breeding and milk records end up in different places, so problems are noticed late: a vaccination is missed, a cow's milk drops for days before anyone connects it to an illness, or the same animals are bred together without anyone checking their ancestry.

HerdSense brings these records into one database with a web application, and uses the database itself to catch these problems. Its objectives are:

1. **Keep every record of an animal consistent.** Cattle, breeding, health, vaccination and milk records are linked by keys and checked by constraints and triggers, so impossible data (a male animal being milked, a calf born before its parents were bred, a farmhand recorded as the vet) is refused by the database.
2. **Trace pedigrees across generations** with recursive SQL over breeding records, so the farm can see an animal's parents, grandparents and great-grandparents.
3. **Flag what needs attention today:** vaccinations due or overdue (due dates kept by a trigger) and cows whose milk yield has dropped well below their own recent average (a stored function).
4. **Find similar past cases from free-text vet notes.** Notes are embedded as vectors (pgvector), so a vet can describe symptoms in their own words and see past cases with similar meaning and the conditions they turned out to be, even when no words match.
5. **Give each kind of farm worker only the access they need.** Owner, Vet and Farmhand accounts sign in to the web app, and the database's own roles and GRANTs decide what each may read or change.

## 2. Functional Requirements

### Users and roles

| Role | Who | Can do |
|------|-----|--------|
| Owner | Farm owner or manager | Everything: manage the herd, record breedings and calvings, record milk, view and manage health records and vaccinations |
| Vet | Veterinarian | Examine animals (add, edit, delete health records), vaccinate, search similar cases; read cattle, breeding and milk records |
| Farmhand | Farm worker | Record milk yield; read the herd list and milk records |

### Requirements

| ID | Requirement | Roles |
|----|-------------|-------|
| FR1 | Sign in with a username and password; sign out. Sessions expire after 8 hours | all |
| FR2 | Show each user only the pages and actions their role allows; refuse other requests in the API and in the database | all |
| FR3 | Show a "Today" dashboard: milk drops, vaccinations due or overdue, milk readings not yet recorded today | all (milk drops and vaccinations: Owner, Vet) |
| FR4 | List the herd with search (tag or name) and filters (status, sex, breed) | all |
| FR5 | Add, edit and delete an animal; refuse a duplicate tag and refuse deleting an animal that is a parent in breeding records | Owner |
| FR6 | Show an animal's page: details, 14-day milk chart, parents and calves, pedigree chart, health history | all (pedigree and health: Owner, Vet) |
| FR7 | Record a breeding (dam, sire, date, natural or AI); check the dam is female and the sire male | Owner |
| FR8 | Record a calving: add the calf and close the breeding record in one transaction | Owner |
| FR9 | Record morning and evening milk readings; refuse a second reading for the same cow, date and session, and readings for male or inactive animals | Owner, Farmhand |
| FR10 | Show daily milk totals and flag cows whose yield dropped more than 20% below their own average | all (drops: Owner, Vet) |
| FR11 | Add, edit and delete examinations (vet notes, suspected condition, treatment, severity); only a Vet can be recorded as the examining vet | Vet (Owner can view, edit, delete) |
| FR12 | Search past vet notes by meaning (vector similarity), by exact words (full-text search) or both side by side; suggest likely conditions from the closest cases | Owner, Vet |
| FR13 | Show, remove and re-create a note's vector; editing a note re-embeds it; deleting a record deletes its vector | Owner, Vet |
| FR14 | Show vaccinations due, overdue or upcoming; vaccinate several animals at once in one transaction; keep each dose's next due date automatically | Vet (Owner can view) |
| FR15 | Validate all input in the database (keys, CHECK, UNIQUE, NOT NULL, triggers) and show the database's message in the interface | all |

### Non-functional requirements

- Database credentials and the session secret come from environment variables (`.env`), never from the source code.
- Passwords are stored as bcrypt hashes; all SQL uses parameters.
- The interface works at laptop and phone widths.

## 3. ER Diagram

![ER diagram](design/er_diagram.png)

The diagram uses crow's foot notation. Seven entities: six relational (`Farm_Staff`, `Cattle`, `Breeding_Records`, `Health_Records`, `Vaccinations`, `Milk_Yield`) and one vector entity (`Note_Embeddings`, shaded).

Key points of the design:

- **Cattle is related to Breeding_Records three times:** as the dam (mother), the sire (father) and the calf. This recursive parent–offspring relationship is what the pedigree queries walk through. Each calf comes from at most one breeding record (`calf_id` is UNIQUE).
- **Farm_Staff** records breedings and milk readings and, as a Vet, examines animals and gives vaccines.
- **Health_Records to Note_Embeddings is one to zero-or-one:** each vet note has at most one vector.

Source files: `docs/design/er_diagram.dot` (Graphviz), `er_diagram.png`, `er_diagram.svg`.

## 4. Relational Schema

PK = primary key, FK = foreign key, UK = unique key.

- **Farm_Staff**(<u>staff_id</u>, full_name, username (UK), password_hash, role, created_at)
- **Cattle**(<u>cattle_id</u>, tag_number (UK), name, breed, sex, date_of_birth, status)
- **Breeding_Records**(<u>breeding_id</u>, dam_id (FK → Cattle), sire_id (FK → Cattle), breeding_date, method, outcome, calf_id (FK → Cattle, UK), recorded_by (FK → Farm_Staff))
- **Health_Records**(<u>health_id</u>, cattle_id (FK → Cattle), vet_id (FK → Farm_Staff), record_date, vet_notes, suspected_condition, treatment, severity)
- **Vaccinations**(<u>vaccination_id</u>, cattle_id (FK → Cattle), vaccine_name, administered_date, interval_days, next_due_date, administered_by (FK → Farm_Staff))
- **Milk_Yield**(<u>yield_id</u>, cattle_id (FK → Cattle), yield_date, session, litres, recorded_by (FK → Farm_Staff)), UK (cattle_id, yield_date, session)
- **Note_Embeddings**(<u>embedding_id</u>, health_id (FK → Health_Records, UK), cattle_id, note_date, suspected_condition, embedding vector(384))

### Foreign keys and delete rules

| Table | Column | References | ON DELETE | Why |
|---|---|---|---|---|
| Breeding_Records | dam_id, sire_id, calf_id | Cattle | RESTRICT | A parent or calf in the pedigree cannot disappear |
| Breeding_Records | recorded_by | Farm_Staff | RESTRICT | Keeps who recorded it |
| Health_Records | cattle_id | Cattle | CASCADE | An animal's records go with it |
| Health_Records | vet_id | Farm_Staff | RESTRICT | Keeps the examining vet |
| Vaccinations | cattle_id | Cattle | CASCADE | As above |
| Vaccinations | administered_by | Farm_Staff | RESTRICT | Keeps who vaccinated |
| Milk_Yield | cattle_id | Cattle | CASCADE | As above |
| Milk_Yield | recorded_by | Farm_Staff | RESTRICT | Keeps who recorded it |
| Note_Embeddings | health_id | Health_Records | CASCADE | A note's vector is deleted with the note |

### Relationships

| Parent | Child | Relationship | Cardinality |
|---|---|---|---|
| Farm_Staff | Health_Records | examines | 1 : N |
| Farm_Staff | Vaccinations | administers | 1 : N |
| Farm_Staff | Milk_Yield | records | 1 : N |
| Farm_Staff | Breeding_Records | records | 1 : N |
| Cattle | Health_Records | has | 1 : N |
| Cattle | Vaccinations | receives | 1 : N |
| Cattle | Milk_Yield | produces | 1 : N |
| Cattle | Breeding_Records | dam of / sire of | 1 : N each |
| Cattle | Breeding_Records | born as (calf) | 1 : 0..1 |
| Health_Records | Note_Embeddings | embedded as | 1 : 0..1 |

### Constraints

| Kind | Where |
|---|---|
| NOT NULL | Every required column, for example `Cattle.breed`, `Health_Records.vet_notes`, `Milk_Yield.litres` |
| UNIQUE | `Farm_Staff.username`, `Cattle.tag_number`, `Breeding_Records.calf_id`, `Note_Embeddings.health_id`, `Milk_Yield (cattle_id, yield_date, session)` |
| CHECK (value lists) | `role IN ('Owner','Vet','Farmhand')`, `sex IN ('F','M')`, `status IN ('Active','Sold','Deceased')`, `method IN ('Natural','AI')`, `outcome IN ('Pending','Calved','Failed')`, `severity IN ('Mild','Moderate','Severe')`, `session IN ('Morning','Evening')` |
| CHECK (values) | Dates not in the future; `litres >= 0`; `interval_days > 0`; notes not blank |
| CHECK (across columns) | `dam_id <> sire_id`; a calf is not its own parent; `(outcome = 'Calved') = (calf_id IS NOT NULL)` |
| DEFAULT | `status 'Active'`, `outcome 'Pending'`, `created_at now()` |
| Triggers (rules that need another table) | Dam female and sire male, calf born after the breeding, milk only for active females, only a Vet examines or vaccinates |

The full column-by-column list is in `docs/design/relational_schema.md`.

### Normalisation

Every table has a single-column surrogate primary key and every non-key column depends only on that key, so the tables are in third normal form. For example, an animal's breed is stored once in `Cattle`, not repeated on each milk reading. Two values are stored on purpose although they can be derived:

- `Vaccinations.next_due_date` (= administered date + interval) is kept so due vaccinations can be found with an index; a trigger always recalculates it, so it cannot become wrong.
- `Note_Embeddings` copies `cattle_id`, `note_date` and `suspected_condition` from the health record as metadata, so vector search can filter without a join; a trigger keeps them in step.

## 5. Database Choice and Justification

| Data | Nature | Database | Why |
|---|---|---|---|
| Cattle, staff, breeding, health records, vaccinations, milk yield | Structured, related, must stay consistent | **PostgreSQL (SQL)** | Keys, constraints and ON DELETE rules keep animals, parents, staff and records consistent; recursive CTEs trace pedigrees; triggers and procedures enforce farm rules; transactions make multi-step changes all-or-nothing; roles and GRANTs give database-level access control; joins and aggregates produce reports |
| Free-text vet notes | Unstructured text, searched by meaning | **Vector database (pgvector)** | Two notes can describe the same condition in different words ("swollen udder, clots in milk" and "hard quarter, abnormal secretion"). Keyword search misses this; embeddings compared by cosine similarity find it |

### Why pgvector rather than a separate vector database

- **One database, one transaction:** the vector is saved, updated and deleted in the same transaction as the note it describes, and a foreign key with ON DELETE CASCADE keeps them consistent. With a separate vector store, extra code would have to keep the two in sync and could fail halfway.
- **Same access control:** the vector table is protected by the same database roles as the health records.
- **Enough scale:** a farm has thousands of notes, not millions. An HNSW index inside PostgreSQL answers nearest-neighbour queries quickly at this size.
- **Trade-off:** a dedicated vector database such as Qdrant or Pinecone scales further and has more specialised features, which this project does not need.

### Why not a document (NoSQL) database

The data is highly relational (animals, their parents, staff and records about them) and relies on joins, constraints and transactions. A document database would give up those guarantees without a matching benefit.

## 6. Data Dictionary

Seven tables: six relational tables and one vector table (`Note_Embeddings`, pgvector).

### Farm_Staff

Farm users who log in and record data. The role decides what each user may do.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| staff_id | SERIAL | PK | No | - | Unique staff identifier |
| full_name | VARCHAR(100) | - | No | - | Staff member's full name |
| username | VARCHAR(50) | UK | No | UNIQUE | Login name |
| password_hash | VARCHAR(255) | - | No | - | bcrypt hash of the password (never the plain password) |
| role | VARCHAR(10) | - | No | CHECK (role IN ('Owner','Vet','Farmhand')) | Access role used for role-based access control |
| created_at | TIMESTAMP | - | No | DEFAULT now() | When the account was created |

### Cattle

One row per animal on the farm.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| cattle_id | SERIAL | PK | No | - | Unique animal identifier |
| tag_number | VARCHAR(20) | UK | No | UNIQUE | Ear-tag number printed on the animal |
| name | VARCHAR(50) | - | Yes | - | Optional pet name |
| breed | VARCHAR(50) | - | No | - | Breed of the animal |
| sex | CHAR(1) | - | No | CHECK (sex IN ('F','M')) | F = female, M = male |
| date_of_birth | DATE | - | No | CHECK (date_of_birth <= CURRENT_DATE) | Birth date |
| status | VARCHAR(10) | - | No | DEFAULT 'Active'; CHECK (status IN ('Active','Sold','Deceased')) | Current status on the farm |

### Breeding_Records

One row per breeding event. Dam, sire and calf all point back to Cattle, which makes the parent-offspring lineage a recursive relationship used for pedigree tracing.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| breeding_id | SERIAL | PK | No | - | Unique breeding event identifier |
| dam_id | INT | FK -> Cattle(cattle_id) | No | - | Mother (the cow bred) |
| sire_id | INT | FK -> Cattle(cattle_id) | No | - | Father (the bull or AI sire) |
| breeding_date | DATE | - | No | CHECK (breeding_date <= CURRENT_DATE) | Date of breeding |
| method | VARCHAR(10) | - | No | CHECK (method IN ('Natural','AI')) | Natural mating or artificial insemination |
| outcome | VARCHAR(10) | - | No | DEFAULT 'Pending'; CHECK (outcome IN ('Pending','Calved','Failed')) | Result of the breeding |
| calf_id | INT | FK, UK -> Cattle(cattle_id) | Yes | UNIQUE | The calf born from this breeding, set once calved. UNIQUE because an animal is born only once |
| recorded_by | INT | FK -> Farm_Staff(staff_id) | No | - | Staff member who entered the record |

Table-level rules:
- CHECK (dam_id <> sire_id): an animal cannot be bred with itself
- CHECK (calf_id IS NULL OR (calf_id <> dam_id AND calf_id <> sire_id)): a calf cannot be its own parent
- CHECK ((outcome = 'Calved') = (calf_id IS NOT NULL)): a calf is recorded exactly when the outcome is Calved

### Health_Records

One row per vet examination. The free-text vet_notes are the source of the embeddings stored in Note_Embeddings.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| health_id | SERIAL | PK | No | - | Unique health record identifier |
| cattle_id | INT | FK -> Cattle(cattle_id) | No | - | Animal examined |
| vet_id | INT | FK -> Farm_Staff(staff_id) | No | - | Staff member who examined the animal |
| record_date | DATE | - | No | CHECK (record_date <= CURRENT_DATE) | Date of the examination |
| vet_notes | TEXT | - | No | CHECK (length(trim(vet_notes)) > 0) | Free-text symptom and observation notes |
| suspected_condition | VARCHAR(100) | - | Yes | - | Condition the vet suspects, for example mastitis |
| treatment | TEXT | - | Yes | - | Treatment given or prescribed |
| severity | VARCHAR(10) | - | No | CHECK (severity IN ('Mild','Moderate','Severe')) | How serious the case is |

### Vaccinations

One row per vaccine dose given. A trigger fills next_due_date, and a view lists animals that are due or overdue.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| vaccination_id | SERIAL | PK | No | - | Unique vaccination identifier |
| cattle_id | INT | FK -> Cattle(cattle_id) | No | - | Animal vaccinated |
| vaccine_name | VARCHAR(100) | - | No | - | Name of the vaccine |
| administered_date | DATE | - | No | CHECK (administered_date <= CURRENT_DATE) | Date the dose was given |
| interval_days | INT | - | No | CHECK (interval_days > 0) | Days until the next dose is needed |
| next_due_date | DATE | - | Yes | - | Set by trigger: administered_date + interval_days |
| administered_by | INT | FK -> Farm_Staff(staff_id) | No | - | Staff member who gave the dose |

### Milk_Yield

One row per milking session per animal. Used for yield-anomaly detection.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| yield_id | SERIAL | PK | No | - | Unique yield record identifier |
| cattle_id | INT | FK -> Cattle(cattle_id) | No | - | Animal milked |
| yield_date | DATE | - | No | CHECK (yield_date <= CURRENT_DATE) | Date of milking |
| session | VARCHAR(10) | - | No | CHECK (session IN ('Morning','Evening')) | Milking session |
| litres | NUMERIC(5,2) | - | No | CHECK (litres >= 0) | Milk collected in litres |
| recorded_by | INT | FK -> Farm_Staff(staff_id) | No | - | Staff member who entered the reading |

Table-level rules:
- UNIQUE (cattle_id, yield_date, session): one reading per animal per session

### Note_Embeddings

Vector store (pgvector). One 384-dimension embedding per vet note, plus the metadata used to filter and display results.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| embedding_id | SERIAL | PK | No | - | Unique embedding identifier |
| health_id | INT | FK, UK -> Health_Records(health_id) | No | UNIQUE | Health record whose vet_notes were embedded (one embedding per note) |
| cattle_id | INT | - | No | - | Metadata: animal the note is about |
| note_date | DATE | - | No | - | Metadata: date of the note |
| suspected_condition | VARCHAR(100) | - | Yes | - | Metadata: condition the vet suspected |
| embedding | vector(384) | - | No | - | all-MiniLM-L6-v2 embedding of vet_notes |

The same tables with their constraints and descriptions are kept in `docs/design/data_dictionary.md`.

## 7. SQL and Vector Database Implementation

All SQL is in the `db/` folder and is run in this order (see the README): pgvector extension, tables, indexes, views, vector table, triggers, functions and procedures, sample data, then roles and GRANTs.

| Folder / file | Contents |
|---|---|
| `db/schema/01_staff.sql`, `02_cattle_breeding_milk.sql`, `03_health_vaccinations.sql` | CREATE TABLE with primary keys, foreign keys and constraints |
| `db/schema/04_indexes.sql` | B-tree indexes for frequent lookups and a GIN full-text index |
| `db/schema/05_views.sql` | Three views |
| `db/schema/alter_drop_demo.sql` | ALTER TABLE and DROP demonstration |
| `db/vector/setup_pgvector.sql`, `note_embeddings.sql` | pgvector extension, vector table and its indexes |
| `db/vector/vector_queries.sql` | Vector read, search, update and delete in SQL |
| `db/logic/triggers_*.sql`, `procedures_*.sql` | Triggers, functions and procedures |
| `db/logic/roles_grants.sql` | Database roles and GRANTs |
| `db/seed/*.sql` | Sample data |
| `db/queries/dml_*.sql`, `queries_*.sql` | DML demonstrations and important queries |

### 7.1 DDL

**CREATE.** Seven tables with named primary key, foreign key, UNIQUE and CHECK constraints, for example:

```sql
CREATE TABLE Breeding_Records (
    breeding_id    SERIAL       PRIMARY KEY,
    dam_id         INT          NOT NULL,
    sire_id        INT          NOT NULL,
    breeding_date  DATE         NOT NULL,
    method         VARCHAR(10)  NOT NULL,
    outcome        VARCHAR(10)  NOT NULL DEFAULT 'Pending',
    calf_id        INT,
    recorded_by    INT          NOT NULL,

    CONSTRAINT fk_breeding_dam   FOREIGN KEY (dam_id)
        REFERENCES Cattle (cattle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_sire  FOREIGN KEY (sire_id)
        REFERENCES Cattle (cattle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_calf  FOREIGN KEY (calf_id)
        REFERENCES Cattle (cattle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_breeding_staff FOREIGN KEY (recorded_by)
        REFERENCES Farm_Staff (staff_id) ON DELETE RESTRICT,

    CONSTRAINT uq_breeding_calf       UNIQUE (calf_id),
    CONSTRAINT chk_breeding_date      CHECK (breeding_date <= CURRENT_DATE),
    CONSTRAINT chk_breeding_method    CHECK (method IN ('Natural', 'AI')),
    CONSTRAINT chk_breeding_outcome   CHECK (outcome IN ('Pending', 'Calved', 'Failed')),
    CONSTRAINT chk_breeding_parents   CHECK (dam_id <> sire_id),
    CONSTRAINT chk_breeding_calf_self CHECK (calf_id IS NULL
                                             OR (calf_id <> dam_id AND calf_id <> sire_id)),
    CONSTRAINT chk_breeding_calved    CHECK ((outcome = 'Calved') = (calf_id IS NOT NULL))
);
```

**ALTER and DROP.** `alter_drop_demo.sql` adds a column to `Cattle`, changes its type, adds and drops a CHECK constraint, renames and drops the column, then creates and drops a table, an index and a view. It runs in a transaction, so the schema is unchanged afterwards (output in `docs/tests/results_alter_drop_demo.txt`).

**Indexes** (`04_indexes.sql`), besides those created by PRIMARY KEY and UNIQUE:

| Index | On | Used by |
|---|---|---|
| `idx_health_cattle_date` | `Health_Records (cattle_id, record_date DESC)` | An animal's health history, newest first |
| `idx_health_notes_fts` | GIN on `to_tsvector('english', vet_notes)` | Full-text search of vet notes |
| `idx_vacc_next_due` | `Vaccinations (next_due_date)` | Vaccinations due |
| `idx_vacc_cattle_name` | `Vaccinations (cattle_id, vaccine_name, administered_date DESC)` | Latest dose of each vaccine |
| `idx_breeding_dam`, `idx_breeding_sire` | `Breeding_Records (dam_id)`, `(sire_id)` | Pedigree and offspring queries |
| `idx_cattle_breed` | `Cattle (breed)` | Filtering the herd by breed |
| `idx_note_embeddings_hnsw` | HNSW on `embedding vector_cosine_ops` | Vector similarity search |
| `idx_note_embeddings_condition`, `idx_note_embeddings_cattle` | Vector metadata | Filtered vector search |

**Views** (`05_views.sql`): `v_vaccinations_due` (latest dose of each vaccine that is due or overdue), `v_cattle_health_summary` (each animal with its number of examinations and latest condition) and `v_daily_milk_totals` (morning and evening litres added up per cow per day). All three use `security_invoker`, so they respect the rights of the user who queries them.

### 7.2 Triggers

| Trigger | Table, timing | What it does |
|---|---|---|
| `trg_vaccination_due_date` | Vaccinations, BEFORE INSERT/UPDATE | Sets `next_due_date = administered_date + interval_days`, so the due date can never be typed wrong |
| `trg_health_requires_vet`, `trg_vaccination_requires_vet` | Health_Records, Vaccinations, BEFORE INSERT/UPDATE | One trigger function (the column name is passed as an argument) refuses a staff member who is not a Vet |
| `trg_health_embedding_sync` | Health_Records, AFTER UPDATE | Keeps the vector table consistent: if the note text changed, deletes the old vector (the app re-embeds it); otherwise copies changed metadata to `Note_Embeddings` |
| `trg_breeding_check` | Breeding_Records, BEFORE INSERT/UPDATE | Dam must be female, sire male, and a calf must be born after the breeding date |
| `trg_milk_yield_check` | Milk_Yield, BEFORE INSERT/UPDATE | Milk can only be recorded for an active female |

Validation triggers raise SQLSTATE 23514 (the same code as a CHECK constraint), so the API reports them the same way.

### 7.3 Functions, procedures and transactions

| Name | Kind | What it does |
|---|---|---|
| `fn_pedigree(animal, generations)` | SQL function, recursive CTE | Ancestors of an animal generation by generation, with dam/sire and the path (`Tulsi <- Arjuna <- Veera`) |
| `fn_yield_anomalies(recent_days, drop_pct)` | SQL function, CTEs, FILTER, LATERAL join | Cows whose average daily milk over the last 3 days is more than 20% below their own average over the rest of the last 30 days, with their latest examination |
| `fn_vaccinations_due(within_days)` | SQL function, DISTINCT ON | Latest dose of each vaccine per active animal that is overdue, due today or due within N days |
| `sp_record_calving(...)` | PL/pgSQL procedure | Locks the breeding record (`SELECT ... FOR UPDATE`), checks it is pending, inserts the calf and marks the breeding as calved. Any failure (duplicate tag, calf born before the breeding) rolls back both changes |
| `sp_vaccinate_herd(...)` | PL/pgSQL procedure | Gives one vaccine to a list of animals; if any animal does not exist or is not active, or the staff member is not a Vet, no dose is saved |

Transactions are also used in the application: adding or editing a health record and storing its vector happen in one transaction (`withTransaction` in `src/lib/db.js`), so a note is never saved without its vector or the other way round.

### 7.4 Database roles (access control in the database)

`db/logic/roles_grants.sql` creates three group roles and one login:

| Database role | Rights |
|---|---|
| `herdsense_owner` | All tables, sequences, functions and procedures |
| `herdsense_vet` | Read, add, change and delete `Health_Records`, `Vaccinations`, `Note_Embeddings`; read `Cattle`, `Breeding_Records`, `Milk_Yield` and the views; `fn_pedigree`, `fn_yield_anomalies`, `fn_vaccinations_due`, `sp_vaccinate_herd`; staff names and roles only (no password hashes) |
| `herdsense_farmhand` | Read, add and change `Milk_Yield`; read `Cattle` and `v_daily_milk_totals`; staff names and roles only |
| `herdsense_app` (login) | Only the `Farm_Staff` columns needed to check a password. It is a member of the three roles `WITH INHERIT FALSE, SET TRUE`: it gets none of their rights automatically, but can switch into one |

The web app connects as `herdsense_app`, and each connection pool switches to the signed-in user's role (`-c role=herdsense_vet`, for example). The database therefore refuses anything that role is not granted (SQLSTATE 42501), even if the API check were missing. EXECUTE on the functions and procedures is revoked from PUBLIC so only the granted roles can call them.

### 7.5 Vector database (pgvector)

| Question | Answer |
|---|---|
| What is embedded | The `vet_notes` text of each health record (symptoms and observations) |
| Model | all-MiniLM-L6-v2 (sentence-transformers), run locally in Node.js with `@huggingface/transformers`; no external API or key |
| Vector | 384 dimensions, mean-pooled and normalised to length 1 |
| Storage | `Note_Embeddings.embedding vector(384)` in the same PostgreSQL database, with metadata `cattle_id`, `note_date`, `suspected_condition`; one vector per note (UNIQUE FK) |
| Index | HNSW with `vector_cosine_ops` |
| Similarity metric | Cosine distance (`<=>`); similarity shown as `1 - distance` |
| Retrieval | Embed the query text with the same model, `ORDER BY embedding <=> query LIMIT k`, optional metadata filters, join back to `Health_Records` and `Cattle`; the conditions of the top matches are tallied to suggest likely conditions |
| Fallback | Full-text search on `vet_notes` with the GIN index |

The vector table is created with:

```sql
CREATE TABLE Note_Embeddings (
    embedding_id         SERIAL        PRIMARY KEY,
    health_id            INT           NOT NULL,
    cattle_id            INT           NOT NULL,     -- metadata
    note_date            DATE          NOT NULL,     -- metadata
    suspected_condition  VARCHAR(100),               -- metadata
    embedding            vector(384)   NOT NULL,     -- all-MiniLM-L6-v2 embedding of vet_notes

    -- One embedding per note; removing the note removes its embedding
    CONSTRAINT uq_embedding_health UNIQUE (health_id),
    CONSTRAINT fk_embedding_health FOREIGN KEY (health_id)
        REFERENCES Health_Records (health_id) ON DELETE CASCADE
);

-- Approximate nearest-neighbour index for cosine distance (<=>)
CREATE INDEX idx_note_embeddings_hnsw
    ON Note_Embeddings USING hnsw (embedding vector_cosine_ops);

-- Metadata filters used alongside similarity search
CREATE INDEX idx_note_embeddings_condition ON Note_Embeddings (suspected_condition);
CREATE INDEX idx_note_embeddings_cattle    ON Note_Embeddings (cattle_id);
```

**Create, read, update and delete on vectors:**

| Operation | In the app | In SQL (`vector_queries.sql`) |
|---|---|---|
| Create | Saving an examination embeds its note in the same transaction; "Add to search" re-creates a removed vector; `npm run embed` fills any missing ones | Upsert with `INSERT ... ON CONFLICT (health_id) DO UPDATE` |
| Read | Similar cases search; "Show vector" displays the dimensions, length and metadata of a note's vector | Nearest neighbours with `<=>`, metadata filter, condition tally, query plan showing the HNSW index |
| Update | Editing a note re-embeds it in one transaction; changing other fields updates the metadata through the trigger | Update a note and see the trigger sync the metadata |
| Delete | "Remove from search" deletes one vector and keeps the record; deleting a record deletes its vector (CASCADE) | DELETE a vector; delete a record and see the vector go |

A note is searched by meaning: the query "inflamed udder and lumpy discoloured milk" shares no words with the stored mastitis notes, so full-text search returns nothing, while vector search returns the mastitis cases first and suggests Mastitis as the likely condition.

### 7.6 Data validation and integrity

Input is validated in the database, not only in the interface:

- Keys and constraints refuse duplicates, missing values, impossible values and broken references.
- Triggers enforce rules that need another table (sex of parents, birth after breeding, milk only for active females, only a Vet examines or vaccinates).
- Procedures and transactions make multi-step changes all-or-nothing.
- ON DELETE RESTRICT protects pedigree data; ON DELETE CASCADE removes dependent records and vectors.
- The API maps database errors to clear messages: 23505 (duplicate) and 23503 (in use or missing) to 409, 23514 / 23502 / 22P02 (invalid value) to 400, 42501 (not allowed) to 403. The interface shows them next to the form.

## 8. Important Queries

The queries are in `db/queries/` and their output is saved in `docs/tests/results_queries_*.txt`.

### DML

`dml_cattle_breeding_milk.sql` and `dml_health_vaccinations.sql` run inside a transaction that is rolled back, so the sample data is kept. They show INSERT (single row with `RETURNING`, several rows at once), UPDATE (simple, with a subquery, and `UPDATE ... FROM` with a join), DELETE (simple and with a subquery) and SELECT.

### Joins, grouping, nested, correlated and recursive queries

| # | Query | Concepts |
|---|---|---|
| C-Q1 | Every calving with the names of dam, sire and calf | INNER JOIN, self-joins on Cattle |
| C-Q2 | Every animal with its recorded parents | LEFT JOIN |
| C-Q3 | Milk summary per cow over the last 30 days, for cows averaging more than 10 litres a day | GROUP BY, HAVING, aggregates |
| C-Q4 | Cows whose average daily yield is above the herd average | Nested subquery |
| C-Q5 | Each cow's last 3 days against her own previous 27 days; drops over 20% flagged | Correlated subquery |
| C-Q6 | Breeding success rate per sire, for sires used at least twice | Conditional aggregates, GROUP BY, HAVING |
| C-Q7 | Active bulls that have sired a calf; active cows never bred | Correlated EXISTS / NOT EXISTS |
| C-Q8 | Pedigree of Tulsi | Recursive CTE (ancestors) |
| C-Q9 | All descendants of the founder cow Ganga | Recursive CTE (descendants) |
| C-Q10 | Recurring illness along each maternal bloodline | Recursive CTE, join, GROUP BY, HAVING |
| C-Q11 | Cows ready to be bred again (60+ days since calving, no pending breeding) | Joins, aggregates, EXISTS |
| H-Q1 | Examinations in the last 90 days with animal and vet | Three-table JOIN |
| H-Q2 | Conditions seen more than once, with animals affected and dates | GROUP BY, HAVING, aggregates |
| H-Q3 | Each vet's workload by severity | Conditional aggregates, LEFT JOIN |
| H-Q4 | Active animals that have never had the LSD vaccine | Nested subquery with NOT IN |
| H-Q5 | Most recent examination of each animal | Correlated subquery |
| H-Q6 | Vaccinations due or overdue | Correlated NOT EXISTS |
| H-Q7 | The same condition coming back in one animal | GROUP BY two columns, HAVING |
| H-Q8 | Animals examined in the last 7 days: milk in the 3 days after against the 3 days before | Nested subqueries on the daily milk view |
| H-Q9 | One timeline of everything recorded for one animal | UNION ALL |
| H-Q10 | Notes about udder, milk, quarter or clots, ranked | Full-text search (GIN index), `ts_rank` |

**Recursive CTE: pedigree (C-Q8).** The anchor row is the animal; each step joins the previous generation to the breeding record where it was the calf, and returns its dam and sire.

```sql
WITH RECURSIVE ancestors AS (
    SELECT c.cattle_id, c.name, 0 AS generation, 'self'::text AS relation, c.name::text AS path
    FROM Cattle c
    WHERE c.cattle_id = 17
    UNION ALL
    SELECT parent.cattle_id, parent.name, a.generation + 1,
           CASE WHEN parent.cattle_id = b.dam_id THEN 'dam' ELSE 'sire' END,
           a.path || ' <- ' || parent.name
    FROM ancestors a
    JOIN Breeding_Records b ON b.calf_id = a.cattle_id
    JOIN Cattle parent      ON parent.cattle_id IN (b.dam_id, b.sire_id)
)
SELECT generation, relation, name, path FROM ancestors ORDER BY generation, relation, name;
```

**Correlated subquery: latest examination of each animal (H-Q5).** The inner query runs for each outer row and finds that animal's latest date.

```sql
SELECT c.name, h.record_date, h.suspected_condition, h.severity
FROM Health_Records h
JOIN Cattle c ON c.cattle_id = h.cattle_id
WHERE h.record_date = (SELECT max(h2.record_date)
                         FROM Health_Records h2
                        WHERE h2.cattle_id = h.cattle_id)
ORDER BY h.record_date DESC;
```

**Vector similarity search** (used by the Similar cases page, `src/lib/noteVectors.js`):

```sql
SELECT ne.health_id, c.tag_number, c.name, ne.note_date, ne.suspected_condition,
       h.vet_notes, h.treatment,
       round((1 - (ne.embedding <=> $1::vector))::numeric, 3) AS similarity
FROM Note_Embeddings ne
JOIN Health_Records h ON h.health_id = ne.health_id
JOIN Cattle c         ON c.cattle_id = ne.cattle_id
WHERE ($2::varchar IS NULL OR ne.suspected_condition = $2)
ORDER BY ne.embedding <=> $1::vector
LIMIT $3;
```

**Yield anomalies** (`fn_yield_anomalies`): daily totals in a CTE, then each cow's recent and baseline averages with `avg(...) FILTER (WHERE ...)`, then a LATERAL join to her latest examination. With the sample data it flags Lakshmi (KA-2003): milk down about 45%, examined for mastitis three days earlier.

## 9. System Architecture

![System architecture](design/architecture.png)

HerdSense has three layers:

1. **Browser.** Next.js pages built with React. They call the API with `fetch` and show the JSON results in forms, tables, charts and the pedigree chart. The menu shows only the pages the user's role can use.
2. **Next.js server (Route Handlers).** 15 API routes under `/api`. Each route:
   1. reads the session cookie and checks the user's role (`requireUser` in `src/lib/auth.js`),
   2. validates the input,
   3. runs parameterised SQL on the connection pool for that role (`poolFor(role)` in `src/lib/db.js`),
   4. returns JSON, or a clear error mapped from the database's SQLSTATE.

   The embedding model runs inside this server (`src/lib/embeddings.js`), so vet notes never leave the farm's computer.
3. **PostgreSQL 17 with pgvector.** The relational tables, the vector table, and the triggers, functions, procedures, views and roles that enforce the rules.

**Sign-in flow.** The login route reads the user's bcrypt hash through the restricted login pool and compares it. It then issues a JWT (HS256, signed with `JWT_SECRET`) in an HttpOnly cookie that lasts 8 hours. Every later request is checked against that cookie.

**Configuration.** Database host, port, name, user and password and the JWT secret come from environment variables in `.env` (template: `.env.example`), which is not committed.

| Layer | Technology |
|---|---|
| Interface | Next.js 16 (App Router), React 19 |
| API | Next.js Route Handlers |
| Authentication | bcryptjs, jose (JWT), HttpOnly cookie |
| Database driver | node-postgres (`pg`) |
| Relational database | PostgreSQL 17 |
| Vector database | pgvector 0.8.7 |
| Embeddings | all-MiniLM-L6-v2 via `@huggingface/transformers` |
| Run environment | Docker (`pgvector/pgvector:pg17-trixie`), Node.js |

## 10. Application Screenshots

### Sign-in

![Sign-in page](screenshots/login.png)

### Today dashboard (Owner)

Milk drops with the latest examination, vaccinations due or overdue, and milk readings not yet recorded today.

![Owner dashboard](screenshots/dashboard_owner.png)

### Cattle list

Search by tag or name and filter by status, sex and breed.

![Cattle list](screenshots/cattle_list.png)

### Animal page: pedigree chart

Tulsi's pedigree from `fn_pedigree`: parents, grandparents and great-grandparents; unknown ancestors shown as "Not recorded".

![Pedigree of Tulsi](screenshots/animal_pedigree_tulsi.png)

### Animal page: milk drop

Lakshmi's last days of milk shown in red (more than 20% below her average), with her mastitis examination.

![Lakshmi's milk drop](screenshots/animal_milk_drop_lakshmi.png)

### Breeding and calving

![Breeding records](screenshots/breeding.png)

### Milk yield: drops flagged by fn_yield_anomalies

![Milk yield drops](screenshots/milk_yield_drops.png)

### Milk entry (Farmhand)

![Milk entry by a farmhand](screenshots/milk_entry_farmhand.png)

### Health records

Examinations with filters; the "In search" column shows whether each note has a vector.

![Health records](screenshots/health_records.png)

### Similar cases: vector search

Symptoms typed in the vet's own words; the closest past cases and the likely conditions.

![Similar cases search](screenshots/similar_cases_semantic.png)

### Similar cases: exact words compared with similar meaning

The same query finds nothing by exact words (full-text search) but finds the mastitis cases by meaning (vector search).

![Keyword and vector search compared](screenshots/similar_cases_compare.png)

### Vaccinations

Doses overdue, due today and upcoming; several animals vaccinated at once with `sp_vaccinate_herd`.

![Vaccinations](screenshots/vaccinations.png)

### Role-based access: a Farmhand opening Health records

![Farmhand refused](screenshots/role_gate_farmhand.png)

### Phone width

<p>
<img src="screenshots/phone_dashboard_vet.png" alt="Vet dashboard on a phone" width="45%">
<img src="screenshots/phone_pedigree.png" alt="Pedigree on a phone" width="45%">
</p>

## 11. Testing Results

HerdSense is tested at three levels: the database, the API over HTTP, and the web interface in a browser. The automated suites run inside a transaction that is rolled back, or remove what they add, so they can be run any number of times. All results below were produced on PostgreSQL 17.12 with pgvector 0.8.7.

| Suite | What it checks | Tests | Result |
|-------|----------------|------:|--------|
| Constraints: cattle, breeding, milk | CHECK, UNIQUE, NOT NULL, foreign keys, RESTRICT and CASCADE, daily milk view | 23 | 23 passed |
| Constraints: staff, health, vaccinations | CHECK, UNIQUE, NOT NULL, foreign keys, cascades, full-text search, views | 19 | 19 passed |
| Triggers, functions, procedures: cattle, breeding, milk | Breeding and milk triggers, `fn_pedigree`, `fn_yield_anomalies`, `sp_record_calving` and its rollback | 18 | 18 passed |
| Triggers, functions, procedures: health, vaccinations | Due-date and vet-only triggers, embedding sync trigger, `fn_vaccinations_due`, `sp_vaccinate_herd` and its rollback | 17 | 17 passed |
| Database roles | What the app login and the Owner, Vet and Farmhand roles may and may not do | 25 | 25 passed |
| Vector database | pgvector setup, 384-dim normalised vectors, semantic vs keyword search, create, read, update, delete, vector-table constraints | 20 | 20 passed |
| API: sign-in, health, vectors, vaccinations | Login, JWT cookie, tampered token, role checks, health records, vector routes, vaccinations | 28 | 28 passed |
| API: cattle, breeding, milk | Cattle CRUD, pedigree, breeding and calving, milk entry, anomalies, role checks | 28 | 28 passed |
| **Automated total** | | **178** | **178 passed** |
| Web interface | Every page for every role at laptop and phone width, forms, error messages, vector actions, data shown | 26 cases | 26 passed |

Examples of what the tests prove:

- **Integrity:** a second reading for the same cow, date and session is refused (UNIQUE); deleting a cow that is a parent is refused (RESTRICT); deleting a health record deletes its vector (CASCADE).
- **Triggers:** a farmhand cannot be recorded as the vet; a calf dated before its breeding is refused; a vaccination's due date is always administered date + interval.
- **Transactions:** a failing `sp_record_calving` or `sp_vaccinate_herd` saves nothing; an invalid note edit leaves both the note and its vector unchanged.
- **Roles:** a Vet cannot change milk records and a Farmhand cannot read health records, refused by the database itself (42501), and neither can read password hashes.
- **Vector search:** reworded mastitis symptoms find no rows by keyword but rank the mastitis notes first by meaning, and Mastitis is suggested as the likely condition.

The test files, their saved results and the web interface test cases are in `docs/tests/`; `docs/tests/README.md` explains how to run them.

## 12. Conclusion

HerdSense brings a dairy farm's cattle, breeding, health, vaccination and milk records into one PostgreSQL database with a Next.js web application, and uses the database to protect and analyse them:

- constraints and triggers refuse impossible data,
- recursive CTEs trace pedigrees,
- functions flag milk drops and due vaccinations,
- procedures and transactions keep multi-step changes all-or-nothing,
- database roles decide what the Owner, Vet and Farmhand may do.

Free-text vet notes, which relational queries cannot search by meaning, are stored as vectors with pgvector in the same database. A vet can describe symptoms in their own words and see similar past cases and likely conditions, even when no words match.

Each technology was chosen for its type of data: PostgreSQL for structured, related records that must stay consistent, and pgvector for meaning-based search over text. Keeping both in one database let a note and its vector be saved, updated and deleted in the same transaction.

**What we learned:**

- **Rules belong in the database.** Putting rules in the database (constraints, triggers, procedures, GRANTs) rather than only in the application means they hold for every way the data is changed.
- **Different questions need different paradigms.** Relational queries and vector search answer different kinds of question, and work best together.

**Limitations:**

- The embedding model is general-purpose English, not veterinary-specific.
- Similar-case results suggest conditions from past cases. They support the vet's judgement but are not a diagnosis.
