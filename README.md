# DBMS Mini-Project

**HerdSense: Livestock Health & Breeding Record Management for Dairy Farms**

DBMS Experiential Learning – Level 3 Project (PES University, Aug–Dec 2026)

## About

HerdSense helps dairy farms manage cattle health, vaccination, breeding, and milk-yield records. Beyond basic record keeping, it:

- traces cattle pedigrees with recursive SQL queries,
- tracks vaccination due dates with triggers and flags unusual milk yield with a stored procedure,
- uses **semantic (vector) search** over vet notes to find similar past cases and likely conditions.

## Team

| Member | SRN | Responsibilities |
|--------|-----|------------------|
| Vaibhav Raj Warrier | PES1UG24CS640 | Cattle core, breeding & pedigree |
| Varun Rao | PES1UG24CS520 | Health, vaccination, vector search & auth |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js |
| Backend/API | Next.js Route Handlers |
| Relational DB | PostgreSQL |
| Vector DB | pgvector (PostgreSQL extension) |
| Embeddings | all-MiniLM-L6-v2 (384 dims), cosine similarity |
| Auth | bcrypt + JWT |
| Version control | Git + GitHub |

## Database Overview

- **SQL (PostgreSQL):** structured, relational data such as cattle, pedigree, health records, vaccinations, breeding, and milk yield, where integrity constraints and transactions matter.
- **Vector (pgvector):** embeddings of free-text vet notes for similarity search, since keyword matching can't capture meaning.

**Advanced features:** transactions, triggers, stored procedures/functions, views, indexes, recursive CTEs, full-text search, vector similarity search (with read/update/delete).

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+ with the `pgvector` extension installed (see below)
- Git
- Internet access the first time embeddings are generated (the model, about 90 MB, is downloaded once and cached)

### Installing pgvector on Windows

Either option works:

- **Build it for your installed PostgreSQL.** Install Visual Studio Build Tools with "Desktop development with C++", open "x64 Native Tools Command Prompt for VS" as administrator, and run (change `16` to your PostgreSQL version):
  ```
  set "PGROOT=C:\Program Files\PostgreSQL\16"
  cd %TEMP%
  git clone --branch v0.8.5 https://github.com/pgvector/pgvector.git
  cd pgvector
  nmake /F Makefile.win
  nmake /F Makefile.win install
  ```
- **Run PostgreSQL with pgvector in Docker:**
  ```
  docker run --name herdsense-db -e POSTGRES_PASSWORD=<password> -p 5432:5432 -d pgvector/pgvector:pg16-trixie
  ```

## Setup & Run

> The SQL scripts and the app are added phase by phase. Steps marked *(later phase)* work once those phases are merged.

```bash
# 1. Clone
git clone https://github.com/vaibh1409/DBMS-Mini-Project.git
cd DBMS-Mini-Project

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# edit .env and fill in your own values

# 4. Create the database and enable pgvector
psql -U <admin_user> -c "CREATE DATABASE herdsense;"
psql -U <admin_user> -d herdsense -f db/vector/setup_pgvector.sql

# 5. Create the tables, indexes, views and the vector table
psql -U <admin_user> -d herdsense -f db/schema/01_staff.sql
psql -U <admin_user> -d herdsense -f db/schema/02_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f db/schema/03_health_vaccinations.sql
psql -U <admin_user> -d herdsense -f db/schema/04_indexes.sql
psql -U <admin_user> -d herdsense -f db/schema/05_views.sql
psql -U <admin_user> -d herdsense -f db/vector/note_embeddings.sql

# 6. Triggers, functions and procedures (before the seed data, so the triggers check it)
psql -U <admin_user> -d herdsense -f db/logic/triggers_health_vaccinations.sql
psql -U <admin_user> -d herdsense -f db/logic/triggers_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f db/logic/procedures_health_vaccinations.sql
psql -U <admin_user> -d herdsense -f db/logic/procedures_cattle_breeding_milk.sql
#    Roles and grants  (later phase)
psql -U <admin_user> -d herdsense -f db/logic/roles_grants.sql

# 7. Load the sample data (in this order; 01 clears all tables first)
psql -U <admin_user> -d herdsense -f db/seed/01_seed_staff.sql
psql -U <admin_user> -d herdsense -f db/seed/02_seed_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f db/seed/03_seed_health_vaccinations.sql

# 8. Generate embeddings for the vet notes
npm run embed

# 9. Start the app  (later phase)
npm run dev
# open http://localhost:3000
```

## Demo Accounts

> For demonstration only. Passwords are stored as bcrypt hashes in the database.

| Role | Username | Password |
|------|----------|----------|
| Owner | owner_demo | Owner@123 |
| Vet | vet_demo | Vet@123 |
| Vet | vet_arjun | Vet@123 |
| Farmhand | farmhand_demo | Farm@123 |
| Farmhand | farmhand_manju | Farm@123 |

## Project Structure

```
db/
  schema/     DDL: tables, indexes, views, ALTER/DROP demo
  logic/      Procedures, triggers, roles and grants
  seed/       Sample data
  queries/    DML demonstrations and important queries
  vector/     pgvector setup, vector table, vector queries
scripts/      Embedding generation and vector demo scripts
src/          Next.js app (pages, API route handlers, components, lib)
docs/
  design/     ER diagram, relational schema, data dictionary, vector design, database choice
  screenshots/
  tests/      Test cases and results
```

## Documentation

- [ER diagram](docs/design/er_diagram.png)
- [Relational schema](docs/design/relational_schema.md)
- [Data dictionary](docs/design/data_dictionary.md)
- [Vector database design](docs/design/vector_design.md)
- [Database choice and justification](docs/design/database_choice.md)

Screenshots, test results and the final report are added to `docs/` as the project progresses.

## Tests and Demos

```bash
# Constraint tests (run inside a transaction and roll back, so no data is kept)
psql -U <admin_user> -d herdsense -f docs/tests/ddl_tests_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f docs/tests/ddl_tests_staff_health_vaccinations.sql

# ALTER and DROP demonstration (leaves the schema unchanged)
psql -U <admin_user> -d herdsense -f db/schema/alter_drop_demo.sql

# DML demonstrations: INSERT, UPDATE, DELETE (rolled back, so the sample data is kept)
psql -U <admin_user> -d herdsense -f db/queries/dml_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f db/queries/dml_health_vaccinations.sql

# Important queries: joins, GROUP BY/HAVING, nested and correlated subqueries, recursive CTEs
psql -U <admin_user> -d herdsense -f db/queries/queries_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f db/queries/queries_health_vaccinations.sql

# Trigger, function and procedure tests (on the seeded database; rolled back)
psql -U <admin_user> -d herdsense -f docs/tests/logic_tests_cattle_breeding_milk.sql
psql -U <admin_user> -d herdsense -f docs/tests/logic_tests_health_vaccinations.sql

# Using the functions and procedures
psql -U <admin_user> -d herdsense -c "SELECT * FROM fn_pedigree(17);"
psql -U <admin_user> -d herdsense -c "SELECT * FROM fn_yield_anomalies();"
psql -U <admin_user> -d herdsense -c "SELECT * FROM fn_vaccinations_due(30);"

# Vector database tests (after `npm run embed`)
node docs/tests/vector_tests.js

# Vector read / update / delete in plain SQL (changes are rolled back)
psql -U <admin_user> -d herdsense -f db/vector/vector_queries.sql

# Vector demo from the command line
node scripts/vector_demo.js search  "swollen udder and clots in milk"
node scripts/vector_demo.js compare "inflamed udder and lumpy discoloured milk"
node scripts/vector_demo.js read    1
node scripts/vector_demo.js update  24 "Mild fever and reduced appetite" "Fever"
node scripts/vector_demo.js delete  24
```

Saved results are in `docs/tests/results_*.txt`.

## Role-Based Access

| Role | Access |
|------|--------|
| Owner | Full access |
| Vet | Health records, treatments, vaccinations |
| Farmhand | Milk yield entry, read-only cattle view |

Enforced both in the backend and at the database level via PostgreSQL roles and GRANTs.

## Security Notes

- No credentials are hard-coded; all configuration comes from environment variables.
- Passwords are hashed with bcrypt.
- `.env` is git-ignored; use `.env.example` as the template.
