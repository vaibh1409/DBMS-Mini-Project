// PostgreSQL connection pool. All settings come from environment variables
// (see .env.example); nothing is hard-coded.
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

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Runs fn(client) inside a transaction: COMMIT on success, ROLLBACK on error.
export async function withTransaction(fn) {
  const client = await pool.connect();
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
