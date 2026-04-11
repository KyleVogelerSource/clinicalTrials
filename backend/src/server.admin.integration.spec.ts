import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  assignUserRoleMock,
  deleteRoleActionMock,
  deleteUserRoleMock,
  authenticateTokenMock,
  requireActionMock,
} = vi.hoisted(() => ({
  assignUserRoleMock: vi.fn(),
  deleteRoleActionMock: vi.fn(),
  deleteUserRoleMock: vi.fn(),
  authenticateTokenMock: vi.fn((_req, _res, next) => next()),
  requireActionMock: vi.fn(() => (_req, _res, next) => next()),
}));

vi.mock("./services/AdminService", async () => {
  const actual = await vi.importActual<typeof import("./services/AdminService")>("./services/AdminService");
  return {
    ...actual,
    assignUserRole: assignUserRoleMock,
    deleteRoleAction: deleteRoleActionMock,
    deleteUserRole: deleteUserRoleMock,
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

import { app } from "./server";

describe("Server admin API tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateTokenMock.mockImplementation((_req, _res, next) => next());
    requireActionMock.mockImplementation(() => (_req, _res, next) => next());
  });

  describe("POST /api/admin/user-roles", () => {
    it("returns 201 on successful assignment", async () => {
      assignUserRoleMock.mockResolvedValueOnce({
        userId: 1,
        username: "alice",
        roleId: 2,
        roleName: "editor",
        createdAt: "2026-04-10T00:00:00.000Z",
      });

      const res = await request(app)
        .post("/api/admin/user-roles")
        .send({ userId: 1, roleId: 2 });

      expect(res.status).toBe(201);
      expect(assignUserRoleMock).toHaveBeenCalledWith(1, 2);
      expect(res.body.username).toBe("alice");
    });

    it("returns 400 for invalid IDs", async () => {
      const res = await request(app)
        .post("/api/admin/user-roles")
        .send({ userId: "abc", roleId: 2 });

      expect(res.status).toBe(400);
      expect(assignUserRoleMock).not.toHaveBeenCalled();
    });

    it("maps domain errors to expected status codes", async () => {
      assignUserRoleMock.mockRejectedValueOnce(new Error("USER_NOT_FOUND"));
      const userMissing = await request(app)
        .post("/api/admin/user-roles")
        .send({ userId: 9, roleId: 2 });

      assignUserRoleMock.mockRejectedValueOnce(new Error("ROLE_NOT_FOUND"));
      const roleMissing = await request(app)
        .post("/api/admin/user-roles")
        .send({ userId: 1, roleId: 99 });

      assignUserRoleMock.mockRejectedValueOnce(new Error("USER_ROLE_EXISTS"));
      const duplicate = await request(app)
        .post("/api/admin/user-roles")
        .send({ userId: 1, roleId: 2 });

      expect(userMissing.status).toBe(404);
      expect(roleMissing.status).toBe(404);
      expect(duplicate.status).toBe(409);
    });
  });

  describe("DELETE /api/admin/role-actions/:roleId/:actionId", () => {
    it("returns 204 on successful delete", async () => {
      deleteRoleActionMock.mockResolvedValueOnce(undefined);

      const res = await request(app).delete("/api/admin/role-actions/2/8");

      expect(res.status).toBe(204);
      expect(deleteRoleActionMock).toHaveBeenCalledWith(2, 8);
    });

    it("returns 400 for invalid path params", async () => {
      const res = await request(app).delete("/api/admin/role-actions/foo/8");

      expect(res.status).toBe(400);
      expect(deleteRoleActionMock).not.toHaveBeenCalled();
    });

    it("returns 404 when relation does not exist", async () => {
      deleteRoleActionMock.mockRejectedValueOnce(new Error("ROLE_ACTION_NOT_FOUND"));

      const res = await request(app).delete("/api/admin/role-actions/2/8");

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/user-roles/:userId/:roleId", () => {
    it("returns 204 on successful delete", async () => {
      deleteUserRoleMock.mockResolvedValueOnce(undefined);

      const res = await request(app).delete("/api/admin/user-roles/3/2");

      expect(res.status).toBe(204);
      expect(deleteUserRoleMock).toHaveBeenCalledWith(3, 2);
    });

    it("returns 400 for invalid path params", async () => {
      const res = await request(app).delete("/api/admin/user-roles/3/bar");

      expect(res.status).toBe(400);
      expect(deleteUserRoleMock).not.toHaveBeenCalled();
    });

    it("returns 404 when relation does not exist", async () => {
      deleteUserRoleMock.mockRejectedValueOnce(new Error("USER_ROLE_NOT_FOUND"));

      const res = await request(app).delete("/api/admin/user-roles/3/2");

      expect(res.status).toBe(404);
    });
  });
});
