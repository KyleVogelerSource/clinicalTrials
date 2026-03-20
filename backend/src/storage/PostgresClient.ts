import { Pool } from "pg";
import bcrypt from "bcryptjs";

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
      password_hash VARCHAR(255) NOT NULL DEFAULT '',
      first_name VARCHAR(100) NOT NULL DEFAULT '',
      last_name VARCHAR(100) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Migrate existing deployments that predate the auth columns
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT ''`);

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

  const adminPasswordHash = await bcrypt.hash("admin", 12);

  const superAdminRoleResult = await pool.query(
    `INSERT INTO roles (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ["super-admin"]
  );

  const userRolesActionResult = await pool.query(
    `INSERT INTO actions (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ["user_roles"]
  );

  await pool.query(
    `INSERT INTO role_actions (role_id, action_id)
     VALUES ($1, $2)
     ON CONFLICT (role_id, action_id) DO NOTHING`,
    [superAdminRoleResult.rows[0].id, userRolesActionResult.rows[0].id]
  );

  const adminUserResult = await pool.query(
    `INSERT INTO users (username, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name
     RETURNING id`,
    ["admin", adminPasswordHash, "Super", "Admin"]
  );

  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [adminUserResult.rows[0].id, superAdminRoleResult.rows[0].id]
  );

  connected = true;
  console.log("PostgreSQL connected and ACL schema initialized.");
}

export function getDbPool() {
  return pool;
}

export function isDatabaseConnected() {
  return connected;
}
