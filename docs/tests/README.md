# Testing

HerdSense is tested at three levels: the database (constraints, triggers, procedures, roles, vectors), the API over HTTP, and the web interface in a browser. Every automated suite runs inside a transaction that is rolled back, or removes what it adds, so it can be run any number of times on the sample data.

## Summary

| Suite | File | What it checks | Tests | Result |
|-------|------|----------------|------:|--------|
| Constraints: cattle, breeding, milk | `ddl_tests_cattle_breeding_milk.sql` | CHECK, UNIQUE, NOT NULL, foreign keys, ON DELETE RESTRICT and CASCADE, daily milk view | 23 | 23 passed |
| Constraints: staff, health, vaccinations | `ddl_tests_staff_health_vaccinations.sql` | CHECK, UNIQUE, NOT NULL, foreign keys, cascades, full-text search, views | 19 | 19 passed |
| Triggers, functions, procedures: cattle, breeding, milk | `logic_tests_cattle_breeding_milk.sql` | Breeding and milk triggers, `fn_pedigree` (recursive CTE), `fn_yield_anomalies`, `sp_record_calving` and its rollback | 18 | 18 passed |
| Triggers, functions, procedures: health, vaccinations | `logic_tests_health_vaccinations.sql` | Due-date and vet-only triggers, embedding sync trigger, `fn_vaccinations_due`, `sp_vaccinate_herd` and its rollback | 17 | 17 passed |
| Database roles | `roles_tests.sql` | What `herdsense_app`, Owner, Vet and Farmhand roles may and may not do, enforced by GRANTs | 25 | 25 passed |
| Vector database | `vector_tests.js` | pgvector setup, 384-dim normalised embeddings, semantic vs keyword search, create, read, update, delete, vector-table constraints | 20 | 20 passed |
| API: sign-in, health, vectors, vaccinations | `api_tests_auth_health.js` | Login, JWT cookie, tampered token, role checks, health records, vector search and embedding routes, vaccinations | 28 | 28 passed |
| API: cattle, breeding, milk | `api_tests_cattle_breeding_milk.js` | Cattle CRUD, pedigree, breeding and calving procedure, milk entry, anomalies, role checks | 28 | 28 passed |
| **Automated total** | | | **178** | **178 passed** |
| Web interface | [`ui_test_cases.md`](ui_test_cases.md) | Every page for every role at laptop and phone width, forms, error messages, vector actions, data shown | 26 cases | 26 passed |

## Demonstration outputs

These files are not pass/fail tests: they run the demonstration scripts and keep their output as evidence.

| Output | Produced by | Shows |
|--------|-------------|-------|
| `results_queries_cattle_breeding_milk.txt` | `db/queries/dml_cattle_breeding_milk.sql`, `db/queries/queries_cattle_breeding_milk.sql` | INSERT, UPDATE, DELETE; joins, GROUP BY/HAVING, nested and correlated subqueries, recursive CTEs |
| `results_queries_health_vaccinations.txt` | `db/queries/dml_health_vaccinations.sql`, `db/queries/queries_health_vaccinations.sql` | INSERT, UPDATE, DELETE; joins, NOT IN/NOT EXISTS, correlated subqueries, UNION ALL, full-text search |
| `results_alter_drop_demo.txt` | `db/schema/alter_drop_demo.sql` | ALTER TABLE and DROP statements, schema left unchanged |
| `results_vector_queries.txt` | `db/vector/vector_queries.sql` | Vector read, similarity search, metadata filter, update and delete in SQL; HNSW index in the query plan |

## Where the results come from

Each `results_*.txt` file was produced by the member who owns that suite, on their own laptop, with the setup in the main README: PostgreSQL 17 with pgvector 0.8.7 (Docker image `pgvector/pgvector:pg17-trixie`), the sample data freshly loaded, and the app running for the API tests. The first lines of each file show when it was run and the PostgreSQL version.

## Running the tests

From the project folder in Command Prompt, with the database container running and the sample data loaded:

```bat
:: Database suites
docker exec herdsense-db psql -U postgres -d herdsense -f /repo/docs/tests/ddl_tests_cattle_breeding_milk.sql
docker exec herdsense-db psql -U postgres -d herdsense -f /repo/docs/tests/ddl_tests_staff_health_vaccinations.sql
docker exec herdsense-db psql -U postgres -d herdsense -f /repo/docs/tests/logic_tests_cattle_breeding_milk.sql
docker exec herdsense-db psql -U postgres -d herdsense -f /repo/docs/tests/logic_tests_health_vaccinations.sql
docker exec herdsense-db psql -U postgres -d herdsense -f /repo/docs/tests/roles_tests.sql

:: Vector database
node docs/tests/vector_tests.js

:: API (start the app first with "npm run dev" in another window)
node docs/tests/api_tests_auth_health.js
node docs/tests/api_tests_cattle_breeding_milk.js
```

Each SQL suite ends with a `passed | total` line and each Node suite with `passed N / N`.
