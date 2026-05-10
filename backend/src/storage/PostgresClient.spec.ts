import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const hashMock = vi.fn();
const poolOnMock = vi.fn();
const poolHandlers = new Map<string, (...args: unknown[]) => void>();
const originalEnv = {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_SSL: process.env.DB_SSL,
  DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED,
  NODE_ENV: process.env.NODE_ENV,
};

vi.mock('pg', () => ({
  Pool: vi.fn(class {
    query = queryMock;
    on = poolOnMock;
  }),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: hashMock,
  },
  hash: hashMock,
}));

describe('PostgresClient.initializeDatabase', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    poolOnMock.mockReset();
    poolHandlers.clear();
    poolOnMock.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      poolHandlers.set(event, handler);
    });
    hashMock.mockReset();
    hashMock.mockResolvedValue('hashed-admin-password');

    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'SELECT 1') {
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('INSERT INTO roles (name)')) {
        return { rows: [{ id: 10 }], rowCount: 1 };
      }

      if (sql.includes('INSERT INTO actions (name)')) {
        const action = (params?.[0] as string) ?? '';
        const actionIds: Record<string, number> = {
          user_roles: 101,
          saved_searches_view_shared: 102,
          trial_benchmarking: 103,
          search_criteria_import: 104,
          search_criteria_export: 105,
        };
        return { rows: [{ id: actionIds[action] }], rowCount: 1 };
      }

      if (sql.includes('INSERT INTO users (username, password_hash, first_name, last_name)')) {
        return { rows: [{ id: 1 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('configures pool SSL and diagnostics from explicit environment variables', async () => {
    process.env.DB_HOST = 'db.example.test';
    process.env.DB_PORT = '6543';
    process.env.DB_NAME = 'ct_env';
    process.env.DB_USER = 'ct_user';
    process.env.DB_PASSWORD = 'ct_password';
    process.env.DB_SSL = 'yes';
    process.env.DB_SSL_REJECT_UNAUTHORIZED = 'on';

    const pg = await import('pg');
    const { getDatabaseConnectionDiagnostics } = await import('./PostgresClient');

    expect(pg.Pool).toHaveBeenCalledWith(expect.objectContaining({
      host: 'db.example.test',
      port: 6543,
      database: 'ct_env',
      user: 'ct_user',
      password: 'ct_password',
      ssl: { rejectUnauthorized: true },
    }));
    expect(getDatabaseConnectionDiagnostics().configuration).toEqual({
      host: 'db.example.test',
      port: 6543,
      database: 'ct_env',
      user: 'ct_user',
      ssl: { enabled: true, rejectUnauthorized: true },
    });
  });

  it('falls back to production SSL defaults for unrecognized boolean values', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_SSL = 'maybe';
    process.env.DB_SSL_REJECT_UNAUTHORIZED = 'maybe';

    const pg = await import('pg');
    const { getDatabaseConnectionDiagnostics } = await import('./PostgresClient');

    expect(pg.Pool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { rejectUnauthorized: false },
    }));
    expect(getDatabaseConnectionDiagnostics().configuration.ssl).toEqual({
      enabled: true,
      rejectUnauthorized: false,
    });
  });

  it('supports explicit SSL disable values', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_SSL = 'off';

    const pg = await import('pg');
    const { getDatabaseConnectionDiagnostics } = await import('./PostgresClient');

    expect(pg.Pool).toHaveBeenCalledWith(expect.objectContaining({
      ssl: false,
    }));
    expect(getDatabaseConnectionDiagnostics().configuration.ssl).toEqual({
      enabled: false,
      rejectUnauthorized: undefined,
    });
  });

  it('seeds search criteria import and export actions and assigns them to super-admin', async () => {
    const { initializeDatabase } = await import('./PostgresClient');

    await initializeDatabase();

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO actions (name)'),
      ['search_criteria_import']
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO actions (name)'),
      ['search_criteria_export']
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO role_actions'),
      [10, [101, 102, 103, 104, 105]]
    );
  });

  it('marks the database connected after initialization and exposes diagnostics', async () => {
    const { getDatabaseConnectionDiagnostics, initializeDatabase, isDatabaseConnected } = await import('./PostgresClient');

    expect(isDatabaseConnected()).toBe(false);

    await initializeDatabase();

    expect(isDatabaseConnected()).toBe(true);
    expect(getDatabaseConnectionDiagnostics()).toEqual(
      expect.objectContaining({
        connected: true,
        failure: null,
        lastSuccessfulConnectionAt: expect.any(String),
        configuration: expect.objectContaining({
          host: 'postgres',
          port: 5432,
          database: 'clinicaltrials',
          user: 'clinicaltrials',
          ssl: { enabled: false, rejectUnauthorized: undefined },
        }),
      })
    );
  });

  it('records initialization failures in diagnostics', async () => {
    const initError = Object.assign(new Error('migration failed'), {
      code: '42P01',
      detail: 'missing relation',
      hint: 'run migrations',
      severity: 'ERROR',
    });
    queryMock.mockRejectedValueOnce(initError);
    const { getDatabaseConnectionDiagnostics, initializeDatabase, isDatabaseConnected } = await import('./PostgresClient');

    await expect(initializeDatabase()).rejects.toThrow('migration failed');

    expect(isDatabaseConnected()).toBe(false);
    expect(getDatabaseConnectionDiagnostics().failure).toEqual(
      expect.objectContaining({
        operation: 'initializeDatabase',
        name: 'Error',
        message: 'migration failed',
        code: '42P01',
        detail: 'missing relation',
        hint: 'run migrations',
        severity: 'ERROR',
      })
    );
  });

  it('probes the database and records success or unknown failures', async () => {
    const { isDatabaseConnected, probeDatabaseConnection } = await import('./PostgresClient');

    const success = await probeDatabaseConnection();
    expect(success.connected).toBe(true);
    expect(isDatabaseConnected()).toBe(true);

    queryMock.mockRejectedValueOnce('connection refused');
    const failure = await probeDatabaseConnection();

    expect(failure.connected).toBe(false);
    expect(failure.failure).toEqual(
      expect.objectContaining({
        operation: 'probeDatabaseConnection',
        name: 'UnknownError',
        message: 'connection refused',
      })
    );
  });

  it('records idle pool errors through the registered event handler', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getDatabaseConnectionDiagnostics, isDatabaseConnected } = await import('./PostgresClient');
    const idleError = new Error('idle client died');

    poolHandlers.get('error')?.(idleError);

    expect(isDatabaseConnected()).toBe(false);
    expect(getDatabaseConnectionDiagnostics().failure).toEqual(
      expect.objectContaining({
        operation: 'pool idle client error',
        message: 'idle client died',
      })
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unexpected PostgreSQL pool error:', idleError);
  });
});
