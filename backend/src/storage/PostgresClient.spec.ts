import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const hashMock = vi.fn();

vi.mock('pg', () => ({
  Pool: vi.fn(class {
    query = queryMock;
    on = vi.fn();
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

  it('does not create the built-in admin account in production without ADMIN_PASSWORD', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_PASSWORD', '');
    try {
      const { initializeDatabase } = await import('./PostgresClient');
      await initializeDatabase();

      expect(queryMock).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users (username, password_hash, first_name, last_name)'),
        expect.anything()
      );
      expect(hashMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('uses ADMIN_PASSWORD for the built-in admin account when set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_PASSWORD', 'a-strong-password');
    try {
      const { initializeDatabase } = await import('./PostgresClient');
      await initializeDatabase();

      expect(hashMock).toHaveBeenCalledWith('a-strong-password', 12);
      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users (username, password_hash, first_name, last_name)'),
        ['admin', 'hashed-admin-password', 'Super', 'Admin']
      );
    } finally {
      vi.unstubAllEnvs();
    }
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
});
