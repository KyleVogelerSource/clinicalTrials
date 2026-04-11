import { getDbPool } from "../storage/PostgresClient";
import { createUserAccount, RegisterInput } from "../auth/AuthService";

export interface AdminUserSummary {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  roles: string[];
}

export interface AdminRoleSummary {
  id: number;
  name: string;
  createdAt: string;
  actions: string[];
}

export interface AdminActionSummary {
  id: number;
  name: string;
  createdAt: string;
}

export interface AdminRoleActionSummary {
  roleId: number;
  roleName: string;
  actionId: number;
  actionName: string;
  createdAt: string;
}

export interface AdminUserRoleSummary {
  userId: number;
  username: string;
  roleId: number;
  roleName: string;
  createdAt: string;
}

export interface AdminSnapshot {
  users: AdminUserSummary[];
  roles: AdminRoleSummary[];
  actions: AdminActionSummary[];
  roleActions: AdminRoleActionSummary[];
  userRoles: AdminUserRoleSummary[];
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const pool = getDbPool();

  const [usersResult, rolesResult, actionsResult, roleActionsResult, userRolesResult] = await Promise.all([
    pool.query(
      `SELECT u.id,
              u.username,
              u.first_name,
              u.last_name,
              u.created_at,
              COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id, u.username, u.first_name, u.last_name, u.created_at
       ORDER BY u.username ASC`
    ),
    pool.query(
      `SELECT r.id,
              r.name,
              r.created_at,
              COALESCE(array_agg(a.name ORDER BY a.name) FILTER (WHERE a.name IS NOT NULL), '{}') AS actions
       FROM roles r
       LEFT JOIN role_actions ra ON ra.role_id = r.id
       LEFT JOIN actions a ON a.id = ra.action_id
       GROUP BY r.id, r.name, r.created_at
       ORDER BY r.name ASC`
    ),
    pool.query(`SELECT id, name, created_at FROM actions ORDER BY name ASC`),
    pool.query(
      `SELECT ra.role_id, r.name AS role_name, ra.action_id, a.name AS action_name, ra.created_at
       FROM role_actions ra
       JOIN roles r ON r.id = ra.role_id
       JOIN actions a ON a.id = ra.action_id
       ORDER BY r.name ASC, a.name ASC`
    ),
    pool.query(
      `SELECT ur.user_id, u.username, ur.role_id, r.name AS role_name, ur.created_at
       FROM user_roles ur
       JOIN users u ON u.id = ur.user_id
       JOIN roles r ON r.id = ur.role_id
       ORDER BY u.username ASC, r.name ASC`
    ),
  ]);

  return {
    users: usersResult.rows.map((row) => ({
      id: row.id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      createdAt: row.created_at,
      roles: row.roles,
    })),
    roles: rolesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      actions: row.actions,
    })),
    actions: actionsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    })),
    roleActions: roleActionsResult.rows.map((row) => ({
      roleId: row.role_id,
      roleName: row.role_name,
      actionId: row.action_id,
      actionName: row.action_name,
      createdAt: row.created_at,
    })),
    userRoles: userRolesResult.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      roleId: row.role_id,
      roleName: row.role_name,
      createdAt: row.created_at,
    })),
  };
}

export async function createAdminUser(input: RegisterInput) {
  return createUserAccount(input);
}

export async function createRole(name: string) {
  const pool = getDbPool();
  const trimmedName = name.trim();

  const result = await pool.query(
    `INSERT INTO roles (name)
     VALUES ($1)
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name, created_at`,
    [trimmedName]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("ROLE_EXISTS");
  }

  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    createdAt: result.rows[0].created_at,
  };
}

export async function assignRoleAction(roleId: number, actionId: number) {
  const pool = getDbPool();

  const roleCheck = await pool.query(`SELECT id, name FROM roles WHERE id = $1`, [roleId]);
  if ((roleCheck.rowCount ?? 0) === 0) {
    throw new Error("ROLE_NOT_FOUND");
  }

  const actionCheck = await pool.query(`SELECT id, name FROM actions WHERE id = $1`, [actionId]);
  if ((actionCheck.rowCount ?? 0) === 0) {
    throw new Error("ACTION_NOT_FOUND");
  }

  const result = await pool.query(
    `INSERT INTO role_actions (role_id, action_id)
     VALUES ($1, $2)
     ON CONFLICT (role_id, action_id) DO NOTHING
     RETURNING created_at`,
    [roleId, actionId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("ROLE_ACTION_EXISTS");
  }

  return {
    roleId,
    roleName: roleCheck.rows[0].name,
    actionId,
    actionName: actionCheck.rows[0].name,
    createdAt: result.rows[0].created_at,
  };
}

export async function assignUserRole(userId: number, roleId: number) {
  const pool = getDbPool();

  const userCheck = await pool.query(`SELECT id, username FROM users WHERE id = $1`, [userId]);
  if ((userCheck.rowCount ?? 0) === 0) {
    throw new Error("USER_NOT_FOUND");
  }

  const roleCheck = await pool.query(`SELECT id, name FROM roles WHERE id = $1`, [roleId]);
  if ((roleCheck.rowCount ?? 0) === 0) {
    throw new Error("ROLE_NOT_FOUND");
  }

  const result = await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING
     RETURNING created_at`,
    [userId, roleId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("USER_ROLE_EXISTS");
  }

  return {
    userId,
    username: userCheck.rows[0].username,
    roleId,
    roleName: roleCheck.rows[0].name,
    createdAt: result.rows[0].created_at,
  };
}

export async function deleteRoleAction(roleId: number, actionId: number) {
  const pool = getDbPool();

  const result = await pool.query(
    `DELETE FROM role_actions
     WHERE role_id = $1 AND action_id = $2`,
    [roleId, actionId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("ROLE_ACTION_NOT_FOUND");
  }
}

export async function deleteUserRole(userId: number, roleId: number) {
  const pool = getDbPool();

  const result = await pool.query(
    `DELETE FROM user_roles
     WHERE user_id = $1 AND role_id = $2`,
    [userId, roleId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("USER_ROLE_NOT_FOUND");
  }
}