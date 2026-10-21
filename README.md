# DBMS Mini-Project

**Livestock Health & Breeding Record Management for Dairy Farms**

DBMS Experiential Learning – Level 3 Project

## About

HerdSense helps dairy farms manage cattle health, vaccination, breeding, and milk-yield records. Beyond basic record keeping, it:

- traces cattle pedigrees (and flags inbreeding) with recursive SQL queries,
- automates vaccination schedules and breeding rules with triggers and stored procedures,
- uses **semantic (vector) search** over vet notes to find similar past cases and suggested conditions.

## Team

| Member | SRN | Responsibilities |
|--------|-----|------------------|
| _Vaibhav Raj Warrier_ | _PES1UG24CS640_ | _Cattle core, breeding & pedigree_ |
| _Varun Rao_ | _PES1UG24CS520_ | _Health, vaccination, vector search & auth_ |

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

**Advanced features:** transactions, triggers, stored procedures/functions, views, indexes, recursive CTEs, vector similarity search (with read/update/delete).

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+ with the `pgvector` extension available
- Git

## Setup & Run

```bash
# 1. Clone
git clone https://github.com/<your-username>/herdsense.git
cd herdsense

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
psql -U <admin_user> -d herdsense -f db/schema/03_indexes.sql
psql -U <admin_user> -d herdsense -f db/schema/04_views.sql
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
| Owner/Admin | _owner_demo_ | _set in seed data_ |
| Vet | _vet_demo_ | _set in seed data_ |
| Farmhand | _farmhand_demo_ | _set in seed data_ |

## Project Structure

```
db/        SQL scripts (schema, logic, seed, queries, vector)
scripts/   Embedding generation scripts
src/       Next.js app (pages, API route handlers, components, lib)
docs/      ER diagram, schema, data dictionary, screenshots, test cases, report
```

## Documentation

See the `docs/` folder for the ER diagram, relational schema, data dictionary, architecture diagram, important queries, screenshots, and test results.

## Role-Based Access

| Role | Access |
|------|--------|
| Owner/Admin | Full access |
| Vet | Health records, treatments, vaccinations |
| Farmhand | Milk yield entry, read-only cattle view |

Enforced both in the backend and at the database level via PostgreSQL roles and GRANTs.

## Security Notes

- No credentials are hard-coded; all configuration comes from environment variables.
- Passwords are hashed with bcrypt.
- `.env` is git-ignored; use `.env.example` as the template.

## Future Enhancements

_To be filled in._
