-- =====================================================================
-- HerdSense | dml_cattle_breeding_milk.sql
-- INSERT, UPDATE, DELETE and SELECT on Cattle, Breeding_Records and
-- Milk_Yield. Everything runs inside one transaction that is rolled
-- back at the end, so the sample data is unchanged afterwards.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- INSERT 1: a calf is born from pending breeding record 16 (dam 15
-- Chandra, sire 6 Shiva). The new animal is inserted and the breeding
-- record is closed in a single statement: the CTE passes the new
-- cattle_id from INSERT ... RETURNING to the UPDATE.
-- ---------------------------------------------------------------------
WITH new_calf AS (
    INSERT INTO Cattle (tag_number, name, breed, sex, date_of_birth)
    VALUES ('KA-4005', 'Ganga II', 'HF Cross', 'F', CURRENT_DATE)
    RETURNING cattle_id
)
UPDATE Breeding_Records b
   SET outcome = 'Calved',
       calf_id = new_calf.cattle_id
  FROM new_calf
 WHERE b.breeding_id = 16;

SELECT b.breeding_id, b.outcome, c.tag_number AS calf_tag, c.name AS calf_name, c.status
FROM Breeding_Records b
JOIN Cattle c ON c.cattle_id = b.calf_id
WHERE b.breeding_id = 16;

-- ---------------------------------------------------------------------
-- INSERT 2: several rows at once (today's milk readings for Meena, 14)
-- ---------------------------------------------------------------------
INSERT INTO Milk_Yield (cattle_id, yield_date, session, litres, recorded_by) VALUES
    (14, CURRENT_DATE, 'Morning', 6.20, 3),
    (14, CURRENT_DATE, 'Evening', 5.10, 5);

SELECT cattle_id, yield_date, session, litres FROM Milk_Yield
WHERE cattle_id = 14 AND yield_date = CURRENT_DATE
ORDER BY session DESC;

-- ---------------------------------------------------------------------
-- UPDATE 1: correct a mistyped reading (evening litres for Meena)
-- ---------------------------------------------------------------------
UPDATE Milk_Yield
   SET litres = 5.40
 WHERE cattle_id = 14 AND yield_date = CURRENT_DATE AND session = 'Evening';

-- ---------------------------------------------------------------------
-- UPDATE 2: sell the young bull Ganesha (20)
-- ---------------------------------------------------------------------
UPDATE Cattle SET status = 'Sold' WHERE cattle_id = 20;

-- ---------------------------------------------------------------------
-- UPDATE 3: update with a subquery. Mark as Failed every breeding that
-- is still Pending more than 300 days after breeding (gestation is
-- about 283 days). The first pending record is back-dated first so
-- the rule has something to act on.
-- ---------------------------------------------------------------------
UPDATE Breeding_Records SET breeding_date = CURRENT_DATE - 320 WHERE breeding_id = 17;

UPDATE Breeding_Records
   SET outcome = 'Failed'
 WHERE breeding_id IN (SELECT breeding_id
                         FROM Breeding_Records
                        WHERE outcome = 'Pending'
                          AND breeding_date < CURRENT_DATE - 300);

SELECT breeding_id, dam_id, breeding_date, outcome
FROM Breeding_Records
WHERE breeding_id IN (16, 17)
ORDER BY breeding_id;

-- ---------------------------------------------------------------------
-- DELETE 1: remove a breeding record entered by mistake (failed AI 15)
-- ---------------------------------------------------------------------
DELETE FROM Breeding_Records WHERE breeding_id = 15 RETURNING breeding_id, dam_id, outcome;

-- ---------------------------------------------------------------------
-- DELETE 2: remove today's readings for Meena again
-- ---------------------------------------------------------------------
DELETE FROM Milk_Yield WHERE cattle_id = 14 AND yield_date = CURRENT_DATE;

-- ---------------------------------------------------------------------
-- SELECT: state of the herd inside the transaction
-- ---------------------------------------------------------------------
SELECT status, count(*) AS animals
FROM Cattle
GROUP BY status
ORDER BY status;

ROLLBACK;

-- After ROLLBACK the sample data is back to how it was
SELECT (SELECT count(*) FROM Cattle)           AS cattle,
       (SELECT count(*) FROM Breeding_Records) AS breeding_records,
       (SELECT outcome FROM Breeding_Records WHERE breeding_id = 16) AS breeding_16_outcome;
