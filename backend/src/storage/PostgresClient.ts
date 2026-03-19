import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST ?? "postgres",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "clinicaltrials",
  user: process.env.DB_USER ?? "clinicaltrials",
  password: process.env.DB_PASSWORD ?? "clinicaltrials",
});

let connected = false;

export async function initializeDatabase() {
  await pool.query("SELECT 1");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS actions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_actions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      action_id INTEGER NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role_id, action_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    )
  `);

  connected = true;
  console.log("PostgreSQL connected and ACL schema initialized.");
}

export function getDbPool() {
  return pool;
}

export function isDatabaseConnected() {
  return connected;
}
