# Relational Schema

Converted from the ER diagram (`er_diagram.png`). PK = primary key, FK = foreign key, UK = unique key.

## Schema in relational notation

- **Farm_Staff**(staff_id (PK), full_name, username (UK), password_hash, role, created_at)
- **Cattle**(cattle_id (PK), tag_number (UK), name, breed, sex, date_of_birth, status)
- **Breeding_Records**(breeding_id (PK), dam_id (FK), sire_id (FK), breeding_date, method, outcome, calf_id (FK, UK), recorded_by (FK))
- **Health_Records**(health_id (PK), cattle_id (FK), vet_id (FK), record_date, vet_notes, suspected_condition, treatment, severity)
- **Vaccinations**(vaccination_id (PK), cattle_id (FK), vaccine_name, administered_date, interval_days, next_due_date, administered_by (FK))
- **Milk_Yield**(yield_id (PK), cattle_id (FK), yield_date, session, litres, recorded_by (FK))
- **Note_Embeddings**(embedding_id (PK), health_id (FK, UK), cattle_id, note_date, suspected_condition, embedding)

## Foreign keys

| Table | Column | References | ON DELETE |
|---|---|---|---|
| Breeding_Records | dam_id | Cattle(cattle_id) | RESTRICT |
| Breeding_Records | sire_id | Cattle(cattle_id) | RESTRICT |
| Breeding_Records | calf_id | Cattle(cattle_id) | RESTRICT |
| Breeding_Records | recorded_by | Farm_Staff(staff_id) | RESTRICT |
| Health_Records | cattle_id | Cattle(cattle_id) | CASCADE |
| Health_Records | vet_id | Farm_Staff(staff_id) | RESTRICT |
| Vaccinations | cattle_id | Cattle(cattle_id) | CASCADE |
| Vaccinations | administered_by | Farm_Staff(staff_id) | RESTRICT |
| Milk_Yield | cattle_id | Cattle(cattle_id) | CASCADE |
| Milk_Yield | recorded_by | Farm_Staff(staff_id) | RESTRICT |
| Note_Embeddings | health_id | Health_Records(health_id) | CASCADE |

`Note_Embeddings.cattle_id` is metadata copied from the health record, not a foreign key. It is kept in step with `Health_Records` by updating both in one transaction.

## Relationships

| Parent | Child | Relationship | Cardinality | Foreign key |
|---|---|---|---|---|
| Farm_Staff | Health_Records | examines | 1 : N | Health_Records.vet_id |
| Farm_Staff | Vaccinations | administers | 1 : N | Vaccinations.administered_by |
| Farm_Staff | Milk_Yield | records | 1 : N | Milk_Yield.recorded_by |
| Farm_Staff | Breeding_Records | records | 1 : N | Breeding_Records.recorded_by |
| Cattle | Health_Records | has | 1 : N | Health_Records.cattle_id |
| Cattle | Vaccinations | receives | 1 : N | Vaccinations.cattle_id |
| Cattle | Milk_Yield | produces | 1 : N | Milk_Yield.cattle_id |
| Cattle | Breeding_Records | dam of | 1 : N | Breeding_Records.dam_id |
| Cattle | Breeding_Records | sire of | 1 : N | Breeding_Records.sire_id |
| Cattle | Breeding_Records | born as (calf) | 1 : 0..1 | Breeding_Records.calf_id |
| Health_Records | Note_Embeddings | embedded as | 1 : 0..1 | Note_Embeddings.health_id |

`Cattle` appears three times as a parent of `Breeding_Records` (dam, sire, calf). That is the recursive parent-offspring relationship that the pedigree recursive CTE walks.

## Constraints

### Column-level constraints

| Table | Column | Constraint |
|---|---|---|
| Farm_Staff | staff_id | PRIMARY KEY |
| Farm_Staff | full_name | NOT NULL |
| Farm_Staff | username | NOT NULL; UNIQUE |
| Farm_Staff | password_hash | NOT NULL |
| Farm_Staff | role | NOT NULL; CHECK (role IN ('Owner','Vet','Farmhand')) |
| Farm_Staff | created_at | NOT NULL; DEFAULT now() |
| Cattle | cattle_id | PRIMARY KEY |
| Cattle | tag_number | NOT NULL; UNIQUE |
| Cattle | breed | NOT NULL |
| Cattle | sex | NOT NULL; CHECK (sex IN ('F','M')) |
| Cattle | date_of_birth | NOT NULL; CHECK (date_of_birth <= CURRENT_DATE) |
| Cattle | status | NOT NULL; DEFAULT 'Active'; CHECK (status IN ('Active','Sold','Deceased')) |
| Breeding_Records | breeding_id | PRIMARY KEY |
| Breeding_Records | dam_id | NOT NULL |
| Breeding_Records | sire_id | NOT NULL |
| Breeding_Records | breeding_date | NOT NULL; CHECK (breeding_date <= CURRENT_DATE) |
| Breeding_Records | method | NOT NULL; CHECK (method IN ('Natural','AI')) |
| Breeding_Records | outcome | NOT NULL; DEFAULT 'Pending'; CHECK (outcome IN ('Pending','Calved','Failed')) |
| Breeding_Records | calf_id | UNIQUE |
| Breeding_Records | recorded_by | NOT NULL |
| Health_Records | health_id | PRIMARY KEY |
| Health_Records | cattle_id | NOT NULL |
| Health_Records | vet_id | NOT NULL |
| Health_Records | record_date | NOT NULL; CHECK (record_date <= CURRENT_DATE) |
| Health_Records | vet_notes | NOT NULL; CHECK (length(trim(vet_notes)) > 0) |
| Health_Records | severity | NOT NULL; CHECK (severity IN ('Mild','Moderate','Severe')) |
| Vaccinations | vaccination_id | PRIMARY KEY |
| Vaccinations | cattle_id | NOT NULL |
| Vaccinations | vaccine_name | NOT NULL |
| Vaccinations | administered_date | NOT NULL; CHECK (administered_date <= CURRENT_DATE) |
| Vaccinations | interval_days | NOT NULL; CHECK (interval_days > 0) |
| Vaccinations | administered_by | NOT NULL |
| Milk_Yield | yield_id | PRIMARY KEY |
| Milk_Yield | cattle_id | NOT NULL |
| Milk_Yield | yield_date | NOT NULL; CHECK (yield_date <= CURRENT_DATE) |
| Milk_Yield | session | NOT NULL; CHECK (session IN ('Morning','Evening')) |
| Milk_Yield | litres | NOT NULL; CHECK (litres >= 0) |
| Milk_Yield | recorded_by | NOT NULL |
| Note_Embeddings | embedding_id | PRIMARY KEY |
| Note_Embeddings | health_id | NOT NULL; UNIQUE |
| Note_Embeddings | cattle_id | NOT NULL |
| Note_Embeddings | note_date | NOT NULL |
| Note_Embeddings | embedding | NOT NULL |

### Table-level constraints

- **Breeding_Records**: CHECK (dam_id <> sire_id): an animal cannot be bred with itself
- **Breeding_Records**: CHECK (calf_id IS NULL OR (calf_id <> dam_id AND calf_id <> sire_id)): a calf cannot be its own parent
- **Breeding_Records**: CHECK ((outcome = 'Calved') = (calf_id IS NOT NULL)): a calf is recorded exactly when the outcome is Calved
- **Milk_Yield**: UNIQUE (cattle_id, yield_date, session): one reading per animal per session
