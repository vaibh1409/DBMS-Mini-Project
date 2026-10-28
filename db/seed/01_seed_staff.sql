-- =====================================================================
-- HerdSense | 01_seed_staff.sql
-- Sample farm staff. Run first: it clears all tables, then adds staff.
-- Passwords are stored as bcrypt hashes (cost 10). Demo passwords:
--   owner_demo / Owner@123    vet_demo / Vet@123    farmhand_demo / Farm@123
--   vet_arjun  / Vet@123      farmhand_manju / Farm@123
-- =====================================================================

-- Start from empty tables (CASCADE clears every table that references these)
TRUNCATE Farm_Staff, Cattle RESTART IDENTITY CASCADE;

INSERT INTO Farm_Staff (staff_id, full_name, username, password_hash, role) VALUES
    (1, 'Ramesh Gowda',     'owner_demo',     '$2b$10$c7Inb0bXJUD93V24PPGWxeZK2HHPljy7r4TQi5URanhUwK7OE/EJC', 'Owner'),
    (2, 'Dr. Kavya Menon',  'vet_demo',       '$2b$10$505RvQGo3gcOIf7u82WdJuqGFpAMkpbc72oLjjS7HiRi74/.Qeh2i', 'Vet'),
    (3, 'Suresh Kumar',     'farmhand_demo',  '$2b$10$hov0ahz7MqCxemMayHGi1Oef2.pQ8eR4BvK9hqB8.pvOh3qiV4lLO', 'Farmhand'),
    (4, 'Dr. Arjun Shetty', 'vet_arjun',      '$2b$10$FAe/h5RQ2xeHidSVCembyOgT3.BshPM7PPIbZNH8/tNDMJ0vUULci', 'Vet'),
    (5, 'Manjunath B',      'farmhand_manju', '$2b$10$nBecOWYQ5vGC0iM/vxgX6u0QE3u/nUVqv1E1fC68Kq6yM.jzJpnOC', 'Farmhand');

-- Keep the SERIAL counter after the explicit ids
DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('farm_staff', 'staff_id'), (SELECT max(staff_id) FROM Farm_Staff)); END $$;
