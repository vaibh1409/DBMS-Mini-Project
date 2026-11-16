// PostgreSQL connections. All settings come from environment variables
// (see .env.example); nothing is hard-coded.
//
// Role-based access is enforced by the database: the app logs in as
// DB_USER (herdsense_app), which has no table rights of its own, and
// each pool switches to one database role when it connects:
//   Owner -> herdsense_owner, Vet -> herdsense_vet, Farmhand -> herdsense_farmhand
// API routes use poolFor(user.role), so every query runs with exactly
// the rights of the signed-in user's role (see db/logic/roles_grants.sql).
import pg from 'pg';

const { Pool, types } = pg;

// Return DATE columns as 'YYYY-MM-DD' strings instead of JavaScript Date
// objects, so dates are not shifted by the computer's time zone.
types.setTypeParser(types.builtins.DATE, (value) => value);

const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter((name) => process.env[name] === undefined);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
}

export const DB_ROLES = {
  Owner: 'herdsense_owner',
  Vet: 'herdsense_vet',
  Farmhand: 'herdsense_farmhand',
};

function createPool(dbRole) {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 5,
    // Switch to the database role as soon as each connection opens
    ...(dbRole && { options: `-c role=${dbRole}` }),
  });
}

// Keep one set of pools per process (Next.js reloads modules in development)
const pools = globalThis.__herdsensePools ?? (globalThis.__herdsensePools = new Map());

function getPool(key, dbRole) {
  if (!pools.has(key)) pools.set(key, createPool(dbRole));
  return pools.get(key);
}

// Pool for one application role ('Owner', 'Vet' or 'Farmhand')
export function poolFor(role) {
  const dbRole = DB_ROLES[role];
  if (!dbRole) throw new Error(`Unknown role: ${role}`);
  return getPool(role, dbRole);
}

// Pool without a role: may only read Farm_Staff to check passwords at sign-in
export function loginPool() {
  return getPool('login', null);
}

// Owner pool, used by the command-line scripts and tests
export const pool = poolFor('Owner');

// Runs fn(client) inside a transaction on the given pool:
// COMMIT on success, ROLLBACK on any error.
export async function withTransaction(fn, db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
