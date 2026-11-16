-- =====================================================================
-- HerdSense | Database role tests (role-based access control)
-- Runs statements AS each role and checks the database itself allows
-- or refuses them. 42501 = insufficient_privilege.
-- Run as the admin user on the seeded database, after roles_grants.sql.
-- Everything runs in a transaction that is rolled back.
--
-- Run:  psql -U <admin_user> -d herdsense -f docs/tests/roles_tests.sql
-- =====================================================================

BEGIN;

CREATE TEMP TABLE test_results (id SERIAL, role TEXT, test TEXT, expected TEXT, actual TEXT, result TEXT);

-- Switches to p_role, runs p_sql, records whether it was allowed or
-- denied, and switches back
CREATE FUNCTION pg_temp.check_as(p_role TEXT, p_test TEXT, p_expected TEXT, p_sql TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_actual TEXT;
BEGIN
    BEGIN
        EXECUTE format('SET LOCAL ROLE %I', p_role);
        EXECUTE p_sql;
        v_actual := 'allowed';
        EXECUTE 'RESET ROLE';
    EXCEPTION WHEN OTHERS THEN
        v_actual := 'denied (' || SQLSTATE || ')';   -- the role switch is undone with the failed statement
    END;
    INSERT INTO test_results (role, test, expected, actual, result)
    VALUES (p_role, p_test, p_expected, v_actual, CASE WHEN v_actual = p_expected THEN 'PASS' ELSE 'FAIL' END);
END $$;

DO $$
BEGIN
    -- App login role: can only check passwords --------------------------------
    PERFORM pg_temp.check_as('herdsense_app', 'R1 read cattle without choosing a role', 'denied (42501)',
        'SELECT * FROM Cattle');
    PERFORM pg_temp.check_as('herdsense_app', 'R2 read usernames and password hashes for sign-in', 'allowed',
        'SELECT username, password_hash FROM Farm_Staff');
    PERFORM pg_temp.check_as('herdsense_app', 'R3 record milk without choosing a role', 'denied (42501)',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by) VALUES (14, CURRENT_DATE - 40, 'Morning', 5, 3)$q$);

    -- Farmhand ---------------------------------------------------------------
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R4 view cattle', 'allowed',
        'SELECT * FROM Cattle');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R5 record milk', 'allowed',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by) VALUES (14, CURRENT_DATE - 40, 'Morning', 5, 3)$q$);
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R6 delete milk records', 'denied (42501)',
        'DELETE FROM Milk_Yield WHERE cattle_id = 14');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R7 read health records', 'denied (42501)',
        'SELECT * FROM Health_Records');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R8 read password hashes', 'denied (42501)',
        'SELECT password_hash FROM Farm_Staff');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R9 read staff names', 'allowed',
        'SELECT full_name, role FROM Farm_Staff');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R10 read health data through a view', 'denied (42501)',
        'SELECT * FROM v_cattle_health_summary');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R11 run the pedigree function', 'denied (42501)',
        'SELECT * FROM fn_pedigree(17)');
    PERFORM pg_temp.check_as('herdsense_farmhand', 'R12 change an animal', 'denied (42501)',
        $q$UPDATE Cattle SET status = 'Sold' WHERE cattle_id = 20$q$);

    -- Vet --------------------------------------------------------------------
    PERFORM pg_temp.check_as('herdsense_vet', 'R13 add a health record', 'allowed',
        $q$INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, severity) VALUES (8, 2, CURRENT_DATE, 'Routine check', 'Mild')$q$);
    PERFORM pg_temp.check_as('herdsense_vet', 'R14 read the health summary view', 'allowed',
        'SELECT * FROM v_cattle_health_summary');
    PERFORM pg_temp.check_as('herdsense_vet', 'R15 add an animal', 'denied (42501)',
        $q$INSERT INTO Cattle (tag_number, breed, sex, date_of_birth) VALUES ('KA-9999', 'Gir', 'F', '2024-01-01')$q$);
    PERFORM pg_temp.check_as('herdsense_vet', 'R16 record milk', 'denied (42501)',
        $q$INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by) VALUES (14, CURRENT_DATE - 41, 'Morning', 5, 3)$q$);
    PERFORM pg_temp.check_as('herdsense_vet', 'R17 vaccinate animals (procedure)', 'allowed',
        $q$CALL sp_vaccinate_herd('LSD', 365, 2, ARRAY[8])$q$);
    PERFORM pg_temp.check_as('herdsense_vet', 'R18 record a calving (owner-only procedure)', 'denied (42501)',
        $q$CALL sp_record_calving(16, 'KA-7001', 'Test', 'F', 'HF Cross')$q$);
    PERFORM pg_temp.check_as('herdsense_vet', 'R19 run yield-anomaly detection', 'allowed',
        'SELECT * FROM fn_yield_anomalies()');
    PERFORM pg_temp.check_as('herdsense_vet', 'R20 update vet-note embedding metadata', 'allowed',
        $q$UPDATE Note_Embeddings SET suspected_condition = 'Mastitis' WHERE health_id = 1$q$);
    PERFORM pg_temp.check_as('herdsense_vet', 'R21 read password hashes', 'denied (42501)',
        'SELECT password_hash FROM Farm_Staff');

    -- Owner ------------------------------------------------------------------
    PERFORM pg_temp.check_as('herdsense_owner', 'R22 add an animal', 'allowed',
        $q$INSERT INTO Cattle (tag_number, breed, sex, date_of_birth) VALUES ('KA-9998', 'Gir', 'F', '2024-01-01')$q$);
    PERFORM pg_temp.check_as('herdsense_owner', 'R23 record a calving (procedure)', 'allowed',
        $q$CALL sp_record_calving(16, 'KA-7001', 'Test', 'F', 'HF Cross')$q$);
    PERFORM pg_temp.check_as('herdsense_owner', 'R24 manage staff accounts', 'allowed',
        'SELECT username, password_hash FROM Farm_Staff');
    PERFORM pg_temp.check_as('herdsense_owner', 'R25 delete milk records', 'allowed',
        'DELETE FROM Milk_Yield WHERE cattle_id = 14');
END $$;

SELECT id AS "#", role, test, expected, actual, result FROM test_results ORDER BY id;

SELECT count(*) FILTER (WHERE result = 'PASS') AS passed, count(*) AS total FROM test_results;

ROLLBACK;
