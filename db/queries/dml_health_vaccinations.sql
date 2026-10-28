-- =====================================================================
-- HerdSense | dml_health_vaccinations.sql
-- INSERT, UPDATE, DELETE and SELECT on Health_Records and
-- Vaccinations. Everything runs inside one transaction that is rolled
-- back at the end, so the sample data is unchanged afterwards.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- INSERT 1: a new vet examination for Meena (14). RETURNING shows the
-- generated health_id.
-- ---------------------------------------------------------------------
INSERT INTO Health_Records (cattle_id, vet_id, record_date, vet_notes, suspected_condition, treatment, severity)
VALUES (14, 2, CURRENT_DATE,
        'Slight swelling of the right hock, walking carefully but eating well.',
        'Lameness', 'Rest on soft bedding, recheck in a week', 'Mild')
RETURNING health_id, cattle_id, record_date, suspected_condition;

-- ---------------------------------------------------------------------
-- INSERT 2: several rows at once (FMD booster for the overdue animals),
-- using INSERT ... SELECT with a filter instead of listing animals.
-- ---------------------------------------------------------------------
INSERT INTO Vaccinations (cattle_id, vaccine_name, administered_date, interval_days, administered_by)
SELECT v.cattle_id, 'FMD', CURRENT_DATE, 180, 2
FROM Vaccinations v
WHERE v.vaccine_name = 'FMD'
  AND v.administered_date = CURRENT_DATE - 200;

SELECT cattle_id, vaccine_name, administered_date
FROM Vaccinations
WHERE administered_date = CURRENT_DATE
ORDER BY cattle_id;

-- ---------------------------------------------------------------------
-- UPDATE 1: the vet adds a follow-up to Lakshmi's mastitis treatment
-- (health record 1) and lowers the severity.
-- ---------------------------------------------------------------------
UPDATE Health_Records
   SET treatment = treatment || '. Follow-up: quarter softer, milk clearing.',
       severity  = 'Mild'
 WHERE health_id = 1;

SELECT health_id, severity, treatment FROM Health_Records WHERE health_id = 1;

-- ---------------------------------------------------------------------
-- UPDATE 2: update with a join (UPDATE ... FROM). Record every vaccine
-- given today as given by the vet who saw the animal most recently.
-- ---------------------------------------------------------------------
UPDATE Vaccinations v
   SET administered_by = latest.vet_id
  FROM (SELECT DISTINCT ON (cattle_id) cattle_id, vet_id
          FROM Health_Records
         ORDER BY cattle_id, record_date DESC) AS latest
 WHERE latest.cattle_id = v.cattle_id
   AND v.administered_date = CURRENT_DATE;

SELECT v.cattle_id, s.full_name AS given_by
FROM Vaccinations v JOIN Farm_Staff s ON s.staff_id = v.administered_by
WHERE v.administered_date = CURRENT_DATE
ORDER BY v.cattle_id;

-- ---------------------------------------------------------------------
-- DELETE 1: one booster was entered for the wrong animal (Tunga, 5)
-- ---------------------------------------------------------------------
DELETE FROM Vaccinations
 WHERE cattle_id = 5 AND administered_date = CURRENT_DATE
RETURNING vaccination_id, cattle_id, vaccine_name;

-- ---------------------------------------------------------------------
-- DELETE 2: delete with a subquery. Remove today's examination of
-- Meena (inserted above).
-- ---------------------------------------------------------------------
DELETE FROM Health_Records
 WHERE health_id = (SELECT max(health_id) FROM Health_Records WHERE cattle_id = 14);

-- ---------------------------------------------------------------------
-- SELECT: counts inside the transaction
-- ---------------------------------------------------------------------
SELECT (SELECT count(*) FROM Health_Records) AS health_records,
       (SELECT count(*) FROM Vaccinations)   AS vaccinations;

ROLLBACK;

-- After ROLLBACK the sample data is back to how it was
SELECT (SELECT count(*) FROM Health_Records) AS health_records,
       (SELECT count(*) FROM Vaccinations)   AS vaccinations,
       (SELECT severity FROM Health_Records WHERE health_id = 1) AS record_1_severity;
