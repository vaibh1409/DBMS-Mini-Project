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
- PostgreSQL 15+ with the `pgvector` extension available
- Git

## Setup & Run

> The SQL scripts and the app are added phase by phase. Steps 4 onward work once those phases are merged.

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

# 5. Run SQL scripts in order
psql -U <admin_user> -d herdsense -f db/schema/01_create_tables.sql
psql -U <admin_user> -d herdsense -f db/schema/02_indexes.sql
psql -U <admin_user> -d herdsense -f db/schema/03_views.sql
psql -U <admin_user> -d herdsense -f db/logic/procedures.sql
psql -U <admin_user> -d herdsense -f db/logic/triggers.sql
psql -U <admin_user> -d herdsense -f db/logic/roles_grants.sql
psql -U <admin_user> -d herdsense -f db/seed/seed_data.sql

# 6. Generate embeddings for seeded vet notes
node scripts/embed_notes.js

# 7. Start the app
npm run dev
# open http://localhost:3000
```

## Demo Accounts

> For demonstration only. Passwords are stored hashed in the database.

| Role | Username | Password |
|------|----------|----------|
| Owner | owner_demo | set in seed data |
| Vet | vet_demo | set in seed data |
| Farmhand | farmhand_demo | set in seed data |

## Project Structure

```
db/
  schema/     DDL: tables, indexes, views
  logic/      Procedures, triggers, roles and grants
  seed/       Sample data
  queries/    Important queries
  vector/     pgvector setup
scripts/      Embedding generation script
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
