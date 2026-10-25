import type { NextFunction, Request, Response } from "express";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeExpressApp } from "./test/expressHarness";

const {
  assignRoleActionMock,
  authenticateTokenMock,
  createAdminUserMock,
  createRoleMock,
  getAdminSnapshotMock,
  isDatabaseConnectedMock,
  requireActionMock,
} = vi.hoisted(() => ({
  assignRoleActionMock: vi.fn(),
  authenticateTokenMock: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  createAdminUserMock: vi.fn(),
  createRoleMock: vi.fn(),
  getAdminSnapshotMock: vi.fn(),
  isDatabaseConnectedMock: vi.fn(),
  requireActionMock: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock("./services/AdminService", async () => {
  const actual = await vi.importActual<typeof import("./services/AdminService")>("./services/AdminService");
  return {
    ...actual,
    assignRoleAction: assignRoleActionMock,
    createAdminUser: createAdminUserMock,
    createRole: createRoleMock,
    getAdminSnapshot: getAdminSnapshotMock,
  };
});

vi.mock("./auth/authMiddleware", async () => {
  const actual = await vi.importActual<typeof import("./auth/authMiddleware")>("./auth/authMiddleware");
  return {
    ...actual,
    authenticateToken: authenticateTokenMock,
    requireAction: requireActionMock,
    userHasAction: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("./storage/PostgresClient", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnected: isDatabaseConnectedMock,
  probeDatabaseConnection: vi.fn().mockResolvedValue({
    connected: true,
    checkedAt: new Date().toISOString(),
    configuration: {
      host: "localhost",
      port: 5432,
      database: "clinicaltrials",
      user: "test",
      ssl: { enabled: false },
    },
    lastSuccessfulConnectionAt: new Date().toISOString(),
    failure: null,
  }),
}));

describe("Server admin create and summary API tests", () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    isDatabaseConnectedMock.mockReturnValue(true);
    ({ app } = await import("./server"));
    authenticateTokenMock.mockImplementation((_req, _res, next) => next());
    requireActionMock.mockImplementation(() => (_req, _res, next) => next());
  });

  it("returns an admin summary snapshot", async () => {
    getAdminSnapshotMock.mockResolvedValueOnce({
      users: [{ id: 1, username: "alice", firstName: "Alice", lastName: "Admin", createdAt: "2026-04-10T00:00:00.000Z", roles: ["admin"] }],
      roles: [{ id: 2, name: "admin", createdAt: "2026-04-10T00:00:00.000Z", actions: ["user_roles"] }],
      actions: [{ id: 3, name: "user_roles", createdAt: "2026-04-10T00:00:00.000Z" }],
      roleActions: [{ roleId: 2, roleName: "admin", actionId: 3, actionName: "user_roles", createdAt: "2026-04-10T00:00:00.000Z" }],
      userRoles: [{ userId: 1, username: "alice", roleId: 2, roleName: "admin", createdAt: "2026-04-10T00:00:00.000Z" }],
    });

    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/admin/summary",
    });

    expect(res.status).toBe(200);
    expect((res.body as { users: unknown[] }).users).toHaveLength(1);
    expect(getAdminSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 for admin routes when the database is unavailable", async () => {
    isDatabaseConnectedMock.mockReturnValue(false);

    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/admin/summary",
    });

    expect(res.status).toBe(503);
    expect(getAdminSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns 500 when admin summary fails unexpectedly", async () => {
    getAdminSnapshotMock.mockRejectedValueOnce(new Error("db failed"));

    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/admin/summary",
    });

    expect(res.status).toBe(500);
  });

  it("creates admin users with trimmed names", async () => {
    createAdminUserMock.mockResolvedValueOnce({
      id: 8,
      username: "new-admin",
      firstName: "New",
      lastName: "Admin",
      createdAt: "2026-04-10T00:00:00.000Z",
    });

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/users",
      body: {
        username: " new-admin ",
        password: "secret",
        firstName: " New ",
        lastName: " Admin ",
      },
    });

    expect(res.status).toBe(201);
    expect(createAdminUserMock).toHaveBeenCalledWith({
      username: "new-admin",
      password: "secret",
      firstName: "New",
      lastName: "Admin",
    });
  });

  it("validates and maps admin user creation errors", async () => {
    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/users",
      body: { username: " ", password: "secret", firstName: "New", lastName: "Admin" },
    });

    createAdminUserMock.mockRejectedValueOnce(new Error("USERNAME_TAKEN"));
    const duplicate = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/users",
      body: { username: "taken", password: "secret", firstName: "Taken", lastName: "User" },
    });

    createAdminUserMock.mockRejectedValueOnce(new Error("db failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/users",
      body: { username: "broken", password: "secret", firstName: "Broken", lastName: "User" },
    });

    expect(invalid.status).toBe(400);
    expect(duplicate.status).toBe(409);
    expect(unexpected.status).toBe(500);
  });

  it("creates roles and maps role creation errors", async () => {
    createRoleMock.mockResolvedValueOnce({
      id: 4,
      name: "reviewer",
      createdAt: "2026-04-10T00:00:00.000Z",
    });

    const created = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/roles",
      body: { name: " reviewer " },
    });

    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/roles",
      body: { name: " " },
    });

    createRoleMock.mockRejectedValueOnce(new Error("ROLE_EXISTS"));
    const duplicate = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/roles",
      body: { name: "reviewer" },
    });

    createRoleMock.mockRejectedValueOnce(new Error("db failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/roles",
      body: { name: "broken" },
    });

    expect(created.status).toBe(201);
    expect(createRoleMock).toHaveBeenCalledWith(" reviewer ");
    expect(invalid.status).toBe(400);
    expect(duplicate.status).toBe(409);
    expect(unexpected.status).toBe(500);
  });

  it("assigns role actions and maps domain errors", async () => {
    assignRoleActionMock.mockResolvedValueOnce({
      roleId: 2,
      roleName: "admin",
      actionId: 3,
      actionName: "user_roles",
      createdAt: "2026-04-10T00:00:00.000Z",
    });

    const created = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/role-actions",
      body: { roleId: 2, actionId: 3 },
    });

    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/role-actions",
      body: { roleId: "2", actionId: 3 },
    });

    assignRoleActionMock.mockRejectedValueOnce(new Error("ROLE_NOT_FOUND"));
    const missingRole = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/role-actions",
      body: { roleId: 99, actionId: 3 },
    });

    assignRoleActionMock.mockRejectedValueOnce(new Error("ACTION_NOT_FOUND"));
    const missingAction = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/role-actions",
      body: { roleId: 2, actionId: 99 },
    });

    assignRoleActionMock.mockRejectedValueOnce(new Error("ROLE_ACTION_EXISTS"));
    const duplicate = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/role-actions",
      body: { roleId: 2, actionId: 3 },
    });

    assignRoleActionMock.mockRejectedValueOnce(new Error("db failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/role-actions",
      body: { roleId: 3, actionId: 4 },
    });

    expect(created.status).toBe(201);
    expect(assignRoleActionMock).toHaveBeenCalledWith(2, 3);
    expect(invalid.status).toBe(400);
    expect(missingRole.status).toBe(404);
    expect(missingAction.status).toBe(404);
    expect(duplicate.status).toBe(409);
    expect(unexpected.status).toBe(500);
  });
});
