import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { ACTION_NAMES } from "../auth/action-names";

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

const defaultDbSslEnabled = process.env.NODE_ENV === "production";
const dbSslEnabled = parseBoolean(process.env.DB_SSL, defaultDbSslEnabled);
const dbSslRejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);

const pool = new Pool({
  host: process.env.DB_HOST ?? "postgres",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "clinicaltrials",
  user: process.env.DB_USER ?? "clinicaltrials",
  password: process.env.DB_PASSWORD ?? "clinicaltrials",
  ssl: dbSslEnabled
    ? {
      rejectUnauthorized: dbSslRejectUnauthorized,
    }
    : false,
});

let connected = false;
let lastConnectionError: DatabaseErrorDetails | null = null;
let lastSuccessfulConnectionAt: string | null = null;

interface DatabaseErrorDetails {
  operation: string;
  capturedAt: string;
  name: string;
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
  severity?: string;
  stack?: string;
}

interface DatabaseConnectionDiagnostics {
  connected: boolean;
  checkedAt: string;
  configuration: {
    host: string;
    port: number;
    database: string;
    user: string;
    ssl: {
      enabled: boolean;
      rejectUnauthorized?: boolean;
    };
  };
  lastSuccessfulConnectionAt: string | null;
  failure: DatabaseErrorDetails | null;
}

const dbConfiguration = {
  host: process.env.DB_HOST ?? "postgres",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "clinicaltrials",
  user: process.env.DB_USER ?? "clinicaltrials",
  ssl: {
    enabled: dbSslEnabled,
    rejectUnauthorized: dbSslEnabled ? dbSslRejectUnauthorized : undefined,
  },
};

function serializeDatabaseError(error: unknown, operation: string): DatabaseErrorDetails {
  const now = new Date().toISOString();

  if (error instanceof Error) {
    const pgError = error as Error & {
      code?: string;
      detail?: string;
      hint?: string;
      severity?: string;
    };

    return {
      operation,
      capturedAt: now,
      name: error.name,
      message: error.message,
      code: pgError.code,
      detail: pgError.detail,
      hint: pgError.hint,
      severity: pgError.severity,
      stack: error.stack,
    };
  }

  return {
    operation,
    capturedAt: now,
    name: "UnknownError",
    message: String(error),
  };
}

function markDatabaseConnected(): void {
  connected = true;
  lastSuccessfulConnectionAt = new Date().toISOString();
  lastConnectionError = null;
}

function markDatabaseDisconnected(error: unknown, operation: string): void {
  connected = false;
  lastConnectionError = serializeDatabaseError(error, operation);
}

function buildDatabaseDiagnostics(checkedAt: string): DatabaseConnectionDiagnostics {
  return {
    connected,
    checkedAt,
    configuration: dbConfiguration,
    lastSuccessfulConnectionAt,
    failure: lastConnectionError,
  };
}

pool.on("error", (error: Error) => {
  markDatabaseDisconnected(error, "pool idle client error");
  console.error("Unexpected PostgreSQL pool error:", error);
});

export async function initializeDatabase() {
  try {
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_searches (
        id SERIAL PRIMARY KEY,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        criteria_json JSONB NOT NULL,
        canonical_key VARCHAR(64) NOT NULL,
        visibility VARCHAR(20) NOT NULL DEFAULT 'private',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT saved_searches_visibility_check
          CHECK (visibility IN ('private', 'shared')),
        CONSTRAINT saved_searches_owner_canonical_key_unique
          UNIQUE (owner_user_id, canonical_key)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_search_access (
        saved_search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        can_view BOOLEAN NOT NULL DEFAULT TRUE,
        can_run BOOLEAN NOT NULL DEFAULT FALSE,
        can_edit BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (saved_search_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_search_runs (
        id SERIAL PRIMARY KEY,
        saved_search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
        run_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL,
        result_count INTEGER NOT NULL DEFAULT 0,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_search_snapshots (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES saved_search_runs(id) ON DELETE CASCADE,
        nct_id VARCHAR(20) NOT NULL,
        rank_position INTEGER NOT NULL,
        normalized_trial_json JSONB NOT NULL,
        raw_trial_json JSONB NOT NULL
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_searches_owner_user_id
        ON saved_searches(owner_user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_search_access_user_id
        ON saved_search_access(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_search_runs_saved_search_id
        ON saved_search_runs(saved_search_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_search_snapshots_run_id
        ON saved_search_snapshots(run_id)
    `);

    const adminPasswordHash = await bcrypt.hash("admin", 12);

    const superAdminRoleResult = await pool.query(
      `INSERT INTO roles (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ["super-admin"]
    );

    const actionResults = await Promise.all([
      pool.query(
        `INSERT INTO actions (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [ACTION_NAMES.userRoles]
      ),
      pool.query(
        `INSERT INTO actions (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [ACTION_NAMES.savedSearchesViewShared]
      ),
      pool.query(
        `INSERT INTO actions (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [ACTION_NAMES.trialBenchmarking]
      ),
      pool.query(
        `INSERT INTO actions (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [ACTION_NAMES.searchCriteriaImport]
      ),
      pool.query(
        `INSERT INTO actions (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [ACTION_NAMES.searchCriteriaExport]
      ),
    ]);

    await pool.query(
      `INSERT INTO role_actions (role_id, action_id)
       SELECT $1, action_id
       FROM unnest($2::INTEGER[]) AS seeded(action_id)
       ON CONFLICT (role_id, action_id) DO NOTHING`,
      [
        superAdminRoleResult.rows[0].id,
        actionResults.map((result) => result.rows[0].id),
      ]
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

    markDatabaseConnected();
    console.log("PostgreSQL connected and ACL schema initialized.");
  } catch (error) {
    markDatabaseDisconnected(error, "initializeDatabase");
    throw error;
  }
}

export async function probeDatabaseConnection(): Promise<DatabaseConnectionDiagnostics> {
  const checkedAt = new Date().toISOString();

  try {
    await pool.query("SELECT 1");
    markDatabaseConnected();
  } catch (error) {
    markDatabaseDisconnected(error, "probeDatabaseConnection");
  }

  return buildDatabaseDiagnostics(checkedAt);
}

export function getDatabaseConnectionDiagnostics(): DatabaseConnectionDiagnostics {
  return buildDatabaseDiagnostics(new Date().toISOString());
}

export function getDbPool() {
  return pool;
}

export function isDatabaseConnected() {
  return connected;
}
