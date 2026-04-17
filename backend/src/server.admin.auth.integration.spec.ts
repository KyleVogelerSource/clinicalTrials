import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth/authMiddleware";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { invokeExpressApp } from "./test/expressHarness";

const {
  assignUserRoleMock,
  deleteRoleActionMock,
  deleteUserRoleMock,
  loginUserMock,
} = vi.hoisted(() => ({
  assignUserRoleMock: vi.fn(),
  deleteRoleActionMock: vi.fn(),
  deleteUserRoleMock: vi.fn(),
  loginUserMock: vi.fn(),
}));

let allowAction = true;

vi.mock("./auth/authMiddleware", async () => {
  const actual = await vi.importActual<typeof import("./auth/authMiddleware")>("./auth/authMiddleware");
  return {
    ...actual,
    requireAction: vi.fn(() => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user?.userId) {
        res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
        return;
      }
      if (!allowAction) {
        res.status(403).json({ error: "Forbidden", message: "unauthorized action" });
        return;
      }
      next();
    }),
  };
});

vi.mock("./services/AdminService", async () => {
  const actual = await vi.importActual<typeof import("./services/AdminService")>("./services/AdminService");
  return {
    ...actual,
    assignUserRole: assignUserRoleMock,
    deleteRoleAction: deleteRoleActionMock,
    deleteUserRole: deleteUserRoleMock,
  };
});

vi.mock("./auth/AuthService", async () => {
  const actual = await vi.importActual<typeof import("./auth/AuthService")>("./auth/AuthService");
  return {
    ...actual,
    loginUser: loginUserMock,
  };
});

vi.mock("./storage/PostgresClient", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
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

describe("Server admin auth flow integration tests", () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    allowAction = true;
    vi.resetModules();
    ({ app } = await import("./server"));
  });

  it("returns 401 when missing bearer token", async () => {
    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/user-roles",
      body: { userId: 1, roleId: 2 },
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for invalid bearer token", async () => {
    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: { authorization: "Bearer not-a-valid-token" },
      body: { userId: 1, roleId: 2 },
    });

    expect(res.status).toBe(401);
  });

  it("allows valid token from login endpoint to call protected admin route", async () => {
    const token = jwt.sign({ userId: 42, username: "admin" }, process.env.JWT_SECRET ?? "dev-secret-change-in-production", {
      expiresIn: "1h",
    });

    loginUserMock.mockResolvedValueOnce({
      token,
      username: "admin",
      firstName: "Super",
      lastName: "Admin",
    });

    assignUserRoleMock.mockResolvedValueOnce({
      userId: 1,
      username: "alice",
      roleId: 2,
      roleName: "editor",
      createdAt: "2026-04-10T00:00:00.000Z",
    });

    const login = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: "admin", password: "admin" },
    });

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/admin/user-roles",
      headers: { authorization: `Bearer ${(login.body as Record<string, string>).token}` },
      body: { userId: 1, roleId: 2 },
    });

    expect(login.status).toBe(200);
    expect(res.status).toBe(201);
    expect(assignUserRoleMock).toHaveBeenCalledWith(1, 2);
  });

  it("returns 403 when role-action authorization fails", async () => {
    const token = jwt.sign({ userId: 42, username: "admin" }, process.env.JWT_SECRET ?? "dev-secret-change-in-production", {
      expiresIn: "1h",
    });

    allowAction = false;

    const res = await invokeExpressApp(app, {
      method: "DELETE",
      url: "/api/admin/user-roles/1/2",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(403);
    expect(deleteUserRoleMock).not.toHaveBeenCalled();
  });

  it("supports valid token on relation delete endpoints", async () => {
    const token = jwt.sign({ userId: 42, username: "admin" }, process.env.JWT_SECRET ?? "dev-secret-change-in-production", {
      expiresIn: "1h",
    });

    deleteRoleActionMock.mockResolvedValueOnce(undefined);
    deleteUserRoleMock.mockResolvedValueOnce(undefined);

    const roleActionDelete = await invokeExpressApp(app, {
      method: "DELETE",
      url: "/api/admin/role-actions/2/8",
      headers: { authorization: `Bearer ${token}` },
    });

    const userRoleDelete = await invokeExpressApp(app, {
      method: "DELETE",
      url: "/api/admin/user-roles/3/2",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(roleActionDelete.status).toBe(204);
    expect(userRoleDelete.status).toBe(204);
    expect(deleteRoleActionMock).toHaveBeenCalledWith(2, 8);
    expect(deleteUserRoleMock).toHaveBeenCalledWith(3, 2);
  });
});
