# Data Dictionary

Seven tables: six relational tables and one vector table (`Note_Embeddings`, pgvector).

## Farm_Staff

Farm users who log in and record data. The role decides what each user may do.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| staff_id | SERIAL | PK | No | - | Unique staff identifier |
| full_name | VARCHAR(100) | - | No | - | Staff member's full name |
| username | VARCHAR(50) | UK | No | UNIQUE | Login name |
| password_hash | VARCHAR(255) | - | No | - | bcrypt hash of the password (never the plain password) |
| role | VARCHAR(10) | - | No | CHECK (role IN ('Owner','Vet','Farmhand')) | Access role used for role-based access control |
| created_at | TIMESTAMP | - | No | DEFAULT now() | When the account was created |

## Cattle

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

## Breeding_Records

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

## Health_Records

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

## Vaccinations

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

## Milk_Yield

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

## Note_Embeddings

Vector store (pgvector). One 384-dimension embedding per vet note, plus the metadata used to filter and display results.

| Column | Type | Key | Null | Constraints | Description |
|---|---|---|---|---|---|
| embedding_id | SERIAL | PK | No | - | Unique embedding identifier |
| health_id | INT | FK, UK -> Health_Records(health_id) | No | UNIQUE | Health record whose vet_notes were embedded (one embedding per note) |
| cattle_id | INT | - | No | - | Metadata: animal the note is about |
| note_date | DATE | - | No | - | Metadata: date of the note |
| suspected_condition | VARCHAR(100) | - | Yes | - | Metadata: condition the vet suspected |
| embedding | vector(384) | - | No | - | all-MiniLM-L6-v2 embedding of vet_notes |
