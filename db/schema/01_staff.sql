-- =====================================================================
-- HerdSense | 01_staff.sql
-- Farm_Staff: users who log in. The role column drives role-based access.
-- Run first: other tables reference Farm_Staff.
-- =====================================================================

DROP TABLE IF EXISTS Farm_Staff CASCADE;

CREATE TABLE Farm_Staff (
    staff_id       SERIAL        PRIMARY KEY,
    full_name      VARCHAR(100)  NOT NULL,
    username       VARCHAR(50)   NOT NULL,
    password_hash  VARCHAR(255)  NOT NULL,
    role           VARCHAR(10)   NOT NULL,
    created_at     TIMESTAMP     NOT NULL DEFAULT now(),

    CONSTRAINT uq_staff_username UNIQUE (username),
    CONSTRAINT chk_staff_role    CHECK (role IN ('Owner', 'Vet', 'Farmhand'))
);
