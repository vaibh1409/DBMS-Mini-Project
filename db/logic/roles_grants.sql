-- =====================================================================
-- HerdSense | roles_grants.sql
-- Role-based access control inside PostgreSQL.
--
--   herdsense_owner     full access
--   herdsense_vet       health records, vaccinations, vet-note vectors;
--                       read-only cattle, breeding and milk
--   herdsense_farmhand  milk yield entry; read-only cattle
--   herdsense_app       the login the web app uses. It has no table
--                       rights of its own except reading Farm_Staff to
--                       check passwords. For each request the app
--                       connects AS one of the three roles above, so the
--                       database itself enforces what that user may do.
--
-- Run after the schema, vector and logic scripts. The app password is
-- passed in as a psql variable, so it is never stored in the repo:
--   psql -U <admin_user> -d herdsense -v app_password=<choose one> -f db/logic/roles_grants.sql
-- Re-running the script is safe.
-- =====================================================================

\if :{?app_password}
\else
    \echo 'Missing app password. Run with:  -v app_password=<choose one>'
    \quit
\endif

-- ---------------------------------------------------------------------
-- 1. Create the roles (only if they do not exist yet)
-- ---------------------------------------------------------------------
SELECT format('CREATE ROLE %I NOLOGIN', r)
FROM unnest(ARRAY['herdsense_owner', 'herdsense_vet', 'herdsense_farmhand']) AS r
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
\gexec

SELECT 'CREATE ROLE herdsense_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'herdsense_app')
\gexec

ALTER ROLE herdsense_app WITH LOGIN PASSWORD :'app_password';

-- The app may switch into each role (SET TRUE) but does not get their
-- rights automatically (INHERIT FALSE): it must choose one per request.
GRANT herdsense_owner, herdsense_vet, herdsense_farmhand TO herdsense_app
    WITH INHERIT FALSE, SET TRUE;

-- ---------------------------------------------------------------------
-- 2. Start from nothing, so re-running gives exactly the rights below
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM herdsense_owner, herdsense_vet, herdsense_farmhand, herdsense_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM herdsense_owner, herdsense_vet, herdsense_farmhand, herdsense_app;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM herdsense_owner, herdsense_vet, herdsense_farmhand, herdsense_app;

-- Functions and procedures are executable by everyone by default;
-- limit them to the roles granted below
REVOKE EXECUTE ON FUNCTION  fn_pedigree(INT, INT)                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION  fn_yield_anomalies(INT, NUMERIC)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION  fn_vaccinations_due(INT)                    FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_record_calving(INT, VARCHAR, VARCHAR, CHAR, VARCHAR, DATE, INT) FROM PUBLIC;
REVOKE EXECUTE ON PROCEDURE sp_vaccinate_herd(VARCHAR, INT, INT, INT[], DATE)                  FROM PUBLIC;

-- Views check the rights of the user querying them, not of the view's
-- owner, so a view cannot be used to read a table the role cannot read
ALTER VIEW v_vaccinations_due      SET (security_invoker = true);
ALTER VIEW v_cattle_health_summary SET (security_invoker = true);
ALTER VIEW v_daily_milk_totals     SET (security_invoker = true);

-- ---------------------------------------------------------------------
-- 3. Owner: full access
-- ---------------------------------------------------------------------
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO herdsense_owner;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO herdsense_owner;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO herdsense_owner;

-- ---------------------------------------------------------------------
-- 4. Vet
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON Health_Records, Vaccinations, Note_Embeddings TO herdsense_vet;
GRANT SELECT ON Cattle, Breeding_Records, Milk_Yield TO herdsense_vet;
GRANT SELECT ON v_vaccinations_due, v_cattle_health_summary, v_daily_milk_totals TO herdsense_vet;
GRANT SELECT (staff_id, full_name, username, role) ON Farm_Staff TO herdsense_vet;   -- no password_hash
GRANT USAGE ON SEQUENCE health_records_health_id_seq,
                        vaccinations_vaccination_id_seq,
                        note_embeddings_embedding_id_seq TO herdsense_vet;
GRANT EXECUTE ON FUNCTION  fn_pedigree(INT, INT), fn_yield_anomalies(INT, NUMERIC), fn_vaccinations_due(INT) TO herdsense_vet;
GRANT EXECUTE ON PROCEDURE sp_vaccinate_herd(VARCHAR, INT, INT, INT[], DATE) TO herdsense_vet;

-- ---------------------------------------------------------------------
-- 5. Farmhand
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON Milk_Yield TO herdsense_farmhand;
GRANT SELECT ON Cattle TO herdsense_farmhand;
GRANT SELECT ON v_daily_milk_totals TO herdsense_farmhand;
GRANT SELECT (staff_id, full_name, username, role) ON Farm_Staff TO herdsense_farmhand;   -- no password_hash
GRANT USAGE ON SEQUENCE milk_yield_yield_id_seq TO herdsense_farmhand;

-- ---------------------------------------------------------------------
-- 6. App login: only enough to check a password at sign-in
-- ---------------------------------------------------------------------
GRANT SELECT (staff_id, full_name, username, password_hash, role) ON Farm_Staff TO herdsense_app;

-- ---------------------------------------------------------------------
-- Summary of table rights per role
-- ---------------------------------------------------------------------
SELECT grantee AS role,
       table_name,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee IN ('herdsense_vet', 'herdsense_farmhand')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
