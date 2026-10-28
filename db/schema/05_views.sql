-- =====================================================================
-- HerdSense | 05_views.sql
-- Views used by the dashboard and reports.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_vaccinations_due: latest dose of each vaccine per animal whose
-- next dose is due today or overdue.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_vaccinations_due AS
SELECT c.cattle_id,
       c.tag_number,
       c.name,
       v.vaccine_name,
       v.administered_date AS last_dose_date,
       v.next_due_date,
       CURRENT_DATE - v.next_due_date AS days_overdue,
       CASE WHEN v.next_due_date < CURRENT_DATE THEN 'Overdue'
            ELSE 'Due Today' END AS due_status
FROM (
    SELECT DISTINCT ON (cattle_id, vaccine_name) *
    FROM Vaccinations
    ORDER BY cattle_id, vaccine_name, administered_date DESC
) v
JOIN Cattle c ON c.cattle_id = v.cattle_id
WHERE c.status = 'Active'
  AND v.next_due_date <= CURRENT_DATE;

-- ---------------------------------------------------------------------
-- v_cattle_health_summary: each animal with its health record count
-- and the most recent examination.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_cattle_health_summary AS
SELECT c.cattle_id,
       c.tag_number,
       c.name,
       c.breed,
       c.status,
       COUNT(h.health_id)  AS health_record_count,
       MAX(h.record_date)  AS last_record_date,
       (SELECT h2.suspected_condition
          FROM Health_Records h2
         WHERE h2.cattle_id = c.cattle_id
         ORDER BY h2.record_date DESC, h2.health_id DESC
         LIMIT 1)          AS last_suspected_condition
FROM Cattle c
LEFT JOIN Health_Records h ON h.cattle_id = c.cattle_id
GROUP BY c.cattle_id, c.tag_number, c.name, c.breed, c.status;

-- ---------------------------------------------------------------------
-- v_daily_milk_totals: total litres per animal per day
-- (Morning + Evening sessions combined).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_daily_milk_totals AS
SELECT m.cattle_id,
       c.tag_number,
       c.name,
       m.yield_date,
       SUM(m.litres)  AS total_litres,
       COUNT(*)       AS sessions_recorded
FROM Milk_Yield m
JOIN Cattle c ON c.cattle_id = m.cattle_id
GROUP BY m.cattle_id, c.tag_number, c.name, m.yield_date;
