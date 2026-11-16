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

- Node.js 20.9 or later, and npm
- PostgreSQL 15+ with the `pgvector` extension. The simplest way on Windows is Docker Desktop, used below.
- Git
- Internet access the first time embeddings are generated (the model, about 90 MB, is downloaded once and cached)

## Setup & Run (Windows, Docker)

Run these in **Command Prompt** (not PowerShell), from the project folder.

```bat
:: 1. Clone and install
git clone https://github.com/vaibh1409/DBMS-Mini-Project.git
cd DBMS-Mini-Project
npm install

:: 2. Start PostgreSQL 17 with pgvector (port 5433 on this computer; the repo is visible as /repo)
docker run --name herdsense-db -e POSTGRES_PASSWORD=<admin_password> -p 5433:5432 -v "%cd%:/repo" -d pgvector/pgvector:pg17-trixie
docker exec herdsense-db psql -U postgres -c "CREATE DATABASE herdsense;"
:: Dates follow the farm's time zone, so "today" is the same day in the browser and the database
docker exec herdsense-db psql -U postgres -c "ALTER DATABASE herdsense SET timezone TO 'Asia/Kolkata';"

:: 3. Build the database: pgvector, tables, indexes, views, vector table,
::    triggers and procedures (before the seed data, so the triggers check it), sample data
for %f in (db/vector/setup_pgvector.sql db/schema/01_staff.sql db/schema/02_cattle_breeding_milk.sql db/schema/03_health_vaccinations.sql db/schema/04_indexes.sql db/schema/05_views.sql db/vector/note_embeddings.sql db/logic/triggers_health_vaccinations.sql db/logic/triggers_cattle_breeding_milk.sql db/logic/procedures_health_vaccinations.sql db/logic/procedures_cattle_breeding_milk.sql db/seed/01_seed_staff.sql db/seed/02_seed_cattle_breeding_milk.sql db/seed/03_seed_health_vaccinations.sql) do docker exec herdsense-db psql -U postgres -d herdsense -v ON_ERROR_STOP=1 -q -f /repo/%f

:: 4. Create the database roles and the app's login (choose its password here)
docker exec herdsense-db psql -U postgres -d herdsense -v ON_ERROR_STOP=1 -v app_password=<app_password> -f /repo/db/logic/roles_grants.sql

:: 5. Configure the app: set DB_PASSWORD to <app_password> and JWT_SECRET to 32+ random characters
copy .env.example .env
notepad .env

:: 6. Generate embeddings for the vet notes
npm run embed

:: 7. Start the app, then open http://localhost:3000
npm run dev
```

Next time: open Docker Desktop, run `docker start herdsense-db`, then `npm run dev`.

Without Docker, run the same SQL files in the same order with `psql -U <admin_user> -d herdsense -f <file>` against a PostgreSQL that has pgvector installed, and set `DB_PORT` in `.env` to that server's port.

## Using the App

Open http://localhost:3000 and sign in with one of the demo accounts below. The menu shows only the pages your role can use.

| Page | Roles | What it does |
|------|-------|--------------|
| Today | all | What needs attention: milk drops, vaccinations due, milk readings not yet recorded |
| Cattle | all | Herd list with search and filters; the Owner adds animals |
| Animal page | all | Details and 14-day milk chart; Owner and Vet also see parents, calves, the pedigree chart and health history; the Owner edits or deletes |
| Milk yield | all | Record a reading (Owner, Farmhand); daily totals or each session; yield drops (Owner, Vet) |
| Breeding | Owner, Vet | Breeding records; the Owner records breedings and calvings |
| Health records | Owner, Vet | Examinations with filters; Vets add them; edit or delete (the note's vector follows) |
| Similar cases | Owner, Vet | Vector search over vet notes, compared with keyword search; show, remove and re-add a note's vector, edit a note and re-embed it |
| Vaccinations | Owner, Vet | Doses due or overdue; Vets vaccinate several animals at once; dose history |

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
src/
  app/        Next.js pages: login, (app)/ signed-in pages, api/ route handlers
  components/ Navigation shell and shared interface parts
  lib/        Database pools per role, sign-in, error handling, embeddings, vector operations, browser API helper
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

[docs/tests/README.md](docs/tests/README.md) lists every test suite, what it covers and its latest results. The web interface test cases are in [docs/tests/ui_test_cases.md](docs/tests/ui_test_cases.md).

The SQL commands below use `psql -U <admin_user> -d herdsense -f <file>`. With Docker, run them as
`docker exec herdsense-db psql -U postgres -d herdsense -f /repo/<file>`.

```bash
# Database role tests: what each role is allowed and refused (rolled back)
psql -U <admin_user> -d herdsense -f docs/tests/roles_tests.sql

# API tests over HTTP (start the app first with `npm run dev` in another window)
node docs/tests/api_tests_auth_health.js
node docs/tests/api_tests_cattle_breeding_milk.js

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

| Role | Database role | Access |
|------|---------------|--------|
| Owner | `herdsense_owner` | Full access |
| Vet | `herdsense_vet` | Health records, treatments, vaccinations, vet-note search; read-only cattle, breeding and milk |
| Farmhand | `herdsense_farmhand` | Milk yield entry, read-only cattle view |

Enforced twice:

1. **In the API:** every route checks the signed-in user's role and answers 403 if it is not allowed.
2. **In the database:** the app logs in as `herdsense_app`, which can only read staff logins. Each request runs as the user's database role, whose GRANTs decide what it may read or change ([roles_grants.sql](db/logic/roles_grants.sql)). Views use `security_invoker`, and password hashes are hidden from Vets and Farmhands with column-level GRANTs.

## API

All routes are under `/api` and return JSON. Sign in first; the session is an HttpOnly cookie.

| Method | Route | Roles | Purpose |
|--------|-------|-------|---------|
| POST | `/auth/login` | everyone | Sign in `{ username, password }` |
| POST | `/auth/logout` | everyone | Sign out |
| GET | `/auth/me` | signed in | Current user |
| GET, POST | `/cattle` | read: all; add: Owner | List (`?status= &sex= &breed= &q=`) / add animals |
| GET, PATCH, DELETE | `/cattle/:id` | read: all; change: Owner | One animal (parents and calves for Owner and Vet) |
| GET | `/cattle/:id/pedigree` | Owner, Vet | Ancestors (`fn_pedigree`, recursive CTE) |
| GET, POST | `/breeding` | read: Owner, Vet; add: Owner | Breeding records |
| POST | `/breeding/:id/calving` | Owner | Record a birth (`sp_record_calving`) |
| GET, POST | `/milk` | read: all; add: Owner, Farmhand | Daily totals or sessions (`?days= &cattleId= &view=`) / record a reading |
| GET | `/milk/anomalies` | Owner, Vet | Yield drops (`fn_yield_anomalies`) |
| GET, POST | `/health-records` | Owner, Vet | List / add an examination (its note is embedded in the same transaction) |
| GET, PATCH, DELETE | `/health-records/:id` | Owner, Vet | One examination; editing re-embeds the note |
| POST | `/notes/search` | Owner, Vet | Semantic, keyword or both `{ text, mode, k, condition }` |
| GET, POST, DELETE | `/notes/:healthId/embedding` | Owner, Vet | Read, (re)create or delete one note's vector |
| GET, POST | `/vaccinations` | read: Owner, Vet; add: Vet | History or `?dueWithin=N` (`fn_vaccinations_due`) / vaccinate (`sp_vaccinate_herd`) |

## Security Notes

- No credentials are hard-coded; all configuration comes from environment variables. The app's database password is passed to `roles_grants.sql` as a psql variable, so it is never stored in the repo.
- Staff passwords are hashed with bcrypt. Sign-in gives the same answer for an unknown user and a wrong password.
- Sessions are JWTs signed with `JWT_SECRET`, kept in an HttpOnly cookie that expires after 8 hours.
- All SQL uses parameters (`$1`, `$2`, ...), never string-built values.
- `.env` is git-ignored; use `.env.example` as the template.
