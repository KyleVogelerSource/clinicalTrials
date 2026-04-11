import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAdminSnapshot,
  createAdminUser,
  createRole,
  assignRoleAction,
  assignUserRole,
  deleteRoleAction,
  deleteUserRole,
} from "./AdminService";
import * as postgresClient from "../storage/PostgresClient";
import * as authService from "../auth/AuthService";

vi.mock("../storage/PostgresClient");
vi.mock("../auth/AuthService");

describe("AdminService", () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    vi.mocked(postgresClient.getDbPool).mockReturnValue(
      mockPool as unknown as ReturnType<typeof postgresClient.getDbPool>
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAdminSnapshot", () => {
    it("should return empty snapshot for empty database", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result).toEqual({
        users: [],
        roles: [],
        actions: [],
        roleActions: [],
        userRoles: [],
      });
    });

    it("should make 5 database queries", async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await getAdminSnapshot();

      expect(mockPool.query).toHaveBeenCalledTimes(5);
    });

    it("should query users with roles", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "john",
              first_name: "John",
              last_name: "Doe",
              created_at: "2024-01-01",
              roles: ["admin", "user"],
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toMatchObject({
        id: 1,
        username: "john",
        firstName: "John",
        lastName: "Doe",
        roles: ["admin", "user"],
      });
    });

    it("should query roles with actions", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: "admin",
              created_at: "2024-01-01",
              actions: ["create_users", "delete_users"],
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.roles).toHaveLength(1);
      expect(result.roles[0]).toMatchObject({
        id: 1,
        name: "admin",
        actions: ["create_users", "delete_users"],
      });
    });

    it("should query all actions", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: "create_users", created_at: "2024-01-01" },
            { id: 2, name: "delete_users", created_at: "2024-01-01" },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.actions).toHaveLength(2);
    });

    it("should query role-actions mappings", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              role_id: 1,
              role_name: "admin",
              action_id: 1,
              action_name: "create_users",
              created_at: "2024-01-01",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.roleActions).toHaveLength(1);
      expect(result.roleActions[0]).toMatchObject({
        roleId: 1,
        roleName: "admin",
        actionId: 1,
        actionName: "create_users",
      });
    });

    it("should query user-roles mappings", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 7,
              username: "jane",
              role_id: 3,
              role_name: "editor",
              created_at: "2024-01-01",
            },
          ],
        });

      const result = await getAdminSnapshot();

      expect(result.userRoles).toHaveLength(1);
      expect(result.userRoles[0]).toMatchObject({
        userId: 7,
        username: "jane",
        roleId: 3,
        roleName: "editor",
      });
    });

    it("should handle multiple users with same role", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "user1",
              first_name: "User",
              last_name: "One",
              created_at: "2024-01-01",
              roles: ["editor"],
            },
            {
              id: 2,
              username: "user2",
              first_name: "User",
              last_name: "Two",
              created_at: "2024-01-02",
              roles: ["editor"],
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.users).toHaveLength(2);
      expect(result.users[0].roles).toEqual(["editor"]);
      expect(result.users[1].roles).toEqual(["editor"]);
    });

    it("should handle users with no roles", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "newuser",
              first_name: "New",
              last_name: "User",
              created_at: "2024-01-01",
              roles: [],
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.users[0].roles).toEqual([]);
    });

    it("should handle empty role arrays in query results", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: "unused_role",
              created_at: "2024-01-01",
              actions: [],
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const result = await getAdminSnapshot();

      expect(result.roles[0].actions).toEqual([]);
    });
  });

  describe("createAdminUser", () => {
    it("should create admin user with provided input", async () => {
      const input = {
        username: "admin1",
        password: "securepass",
        firstName: "Admin",
        lastName: "User",
      };

      vi.mocked(authService.createUserAccount).mockResolvedValue({
        id: 1,
        username: "admin1",
        firstName: "Admin",
        lastName: "User",
      });

      const result = await createAdminUser(input);

      expect(authService.createUserAccount).toHaveBeenCalledWith(input);
      expect(result).toEqual({
        id: 1,
        username: "admin1",
        firstName: "Admin",
        lastName: "User",
      });
    });

    it("should propagate auth service errors", async () => {
      const input = {
        username: "duplicate",
        password: "pass",
        firstName: "Dup",
        lastName: "User",
      };

      vi.mocked(authService.createUserAccount).mockRejectedValue(
        new Error("USERNAME_TAKEN")
      );

      await expect(createAdminUser(input)).rejects.toThrow("USERNAME_TAKEN");
    });
  });

  describe("createRole", () => {
    it("should create a new role successfully", async () => {
      const roleName = "editor";

      mockPool.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            name: "editor",
            created_at: "2024-01-01",
          },
        ],
      });

      const result = await createRole(roleName);

      expect(result).toMatchObject({
        id: 1,
        name: "editor",
        createdAt: "2024-01-01",
      });
    });

    it("should throw error if role already exists", async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      await expect(createRole("existing_role")).rejects.toThrow("ROLE_EXISTS");
    });

    it("should trim role name before inserting", async () => {
      mockPool.query.mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 1, name: "trimmed", created_at: "2024-01-01" }],
      });

      await createRole("  role_with_spaces  ");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ["role_with_spaces"]
      );
    });

    it("should use INSERT with ON CONFLICT", async () => {
      mockPool.query.mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 1, name: "test", created_at: "2024-01-01" }],
      });

      await createRole("test");

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain("INSERT INTO roles");
      expect(query).toContain("ON CONFLICT");
    });

    it("should handle special characters in role name", async () => {
      mockPool.query.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            id: 1,
            name: "role_with-special.chars",
            created_at: "2024-01-01",
          },
        ],
      });

      const result = await createRole("role_with-special.chars");

      expect(result.name).toBe("role_with-special.chars");
    });

    it("should handle empty string after trimming", async () => {
      mockPool.query.mockResolvedValue({
        rowCount: 0,
      });

      await expect(createRole("   ")).rejects.toThrow();
    });
  });

  describe("assignRoleAction", () => {
    it("should assign action to role successfully", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1, name: "admin" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "delete_users" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ created_at: "2024-01-01" }],
        });

      const result = await assignRoleAction(1, 5);

      expect(result).toMatchObject({
        roleId: 1,
        roleName: "admin",
        actionId: 5,
        actionName: "delete_users",
        createdAt: "2024-01-01",
      });
    });

    it("should throw ROLE_NOT_FOUND when role doesn't exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(assignRoleAction(999, 1)).rejects.toThrow("ROLE_NOT_FOUND");
    });

    it("should throw ACTION_NOT_FOUND when action doesn't exist", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, name: "admin" }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      await expect(assignRoleAction(1, 999)).rejects.toThrow("ACTION_NOT_FOUND");
    });

    it("should throw ROLE_ACTION_EXISTS when already assigned", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1, name: "admin" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "action" }],
        })
        .mockResolvedValueOnce({ rowCount: 0 });

      await expect(assignRoleAction(1, 5)).rejects.toThrow("ROLE_ACTION_EXISTS");
    });

    it("should make 3 database queries in order", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, name: "admin" }] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "action" }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ created_at: "2024-01-01" }] });

      await assignRoleAction(1, 5);

      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it("should verify role exists before action", async () => {
      const roleCheck = vi.fn().mockResolvedValue({ rowCount: 0 });
      const actionCheck = vi.fn();
      mockPool.query
        .mockImplementationOnce(roleCheck)
        .mockImplementationOnce(actionCheck);

      try {
        await assignRoleAction(1, 5);
      } catch {
        // Expected
      }

      expect(roleCheck).toHaveBeenCalled();
      expect(actionCheck).not.toHaveBeenCalled();
    });

    it("should use ON CONFLICT DO NOTHING", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, name: "admin" }] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "action" }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ created_at: "2024-01-01" }] });

      await assignRoleAction(1, 5);

      const insertQuery = mockPool.query.mock.calls[2][0];
      expect(insertQuery).toContain("INSERT INTO role_actions");
      expect(insertQuery).toContain("ON CONFLICT");
    });

    it("should return correct role and action names from database", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 10, name: "editor" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 20, name: "publish_content" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ created_at: "2024-03-15" }],
        });

      const result = await assignRoleAction(10, 20);

      expect(result.roleName).toBe("editor");
      expect(result.actionName).toBe("publish_content");
    });

    it("should handle null rowCount gracefully", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: null, rows: [{ id: 1, name: "admin" }] })
        .mockResolvedValueOnce({
          rowCount: null,
          rows: [{ id: 5, name: "action" }],
        })
        .mockResolvedValueOnce({ rowCount: null });

      await expect(assignRoleAction(1, 5)).rejects.toThrow();
    });

    it("should pass correct parameters to database", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, name: "admin" }] })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "action" }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ created_at: "2024-01-01" }] });

      await assignRoleAction(1, 5);

      // Check role verification
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("SELECT id, name FROM roles"),
        [1]
      );

      // Check action verification
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("SELECT id, name FROM actions"),
        [5]
      );

      // Check insert
      expect(mockPool.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("INSERT INTO role_actions"),
        [1, 5]
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in role/action names", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1, name: "admin-role_v2" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "action.create.v1.0" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ created_at: "2024-01-01" }],
        });

      const result = await assignRoleAction(1, 5);

      expect(result.roleName).toBe("admin-role_v2");
      expect(result.actionName).toBe("action.create.v1.0");
    });

    it("should handle Unicode characters in names", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 1, name: "роль_админ" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 5, name: "действие_удалить" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ created_at: "2024-01-01" }],
        });

      const result = await assignRoleAction(1, 5);

      expect(result.roleName).toContain("роль");
    });

    it("should handle very large IDs", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 2147483647, name: "admin" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 2147483647, name: "action" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ created_at: "2024-01-01" }],
        });

      const result = await assignRoleAction(2147483647, 2147483647);

      expect(result.roleId).toBe(2147483647);
    });
  });

  describe("assignUserRole", () => {
    it("should assign role to user successfully", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 10, username: "alice" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id: 2, name: "editor" }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ created_at: "2024-01-01" }],
        });

      const result = await assignUserRole(10, 2);

      expect(result).toMatchObject({
        userId: 10,
        username: "alice",
        roleId: 2,
        roleName: "editor",
        createdAt: "2024-01-01",
      });
    });

    it("should throw USER_NOT_FOUND when user doesn't exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(assignUserRole(999, 2)).rejects.toThrow("USER_NOT_FOUND");
    });

    it("should throw ROLE_NOT_FOUND when role doesn't exist", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, username: "alice" }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      await expect(assignUserRole(1, 999)).rejects.toThrow("ROLE_NOT_FOUND");
    });

    it("should throw USER_ROLE_EXISTS when already assigned", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, username: "alice" }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 2, name: "editor" }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      await expect(assignUserRole(1, 2)).rejects.toThrow("USER_ROLE_EXISTS");
    });
  });

  describe("deleteRoleAction", () => {
    it("should delete an existing role-action relation", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await expect(deleteRoleAction(1, 2)).resolves.toBeUndefined();
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM role_actions"), [1, 2]);
    });

    it("should throw ROLE_ACTION_NOT_FOUND when relation is missing", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(deleteRoleAction(1, 2)).rejects.toThrow("ROLE_ACTION_NOT_FOUND");
    });
  });

  describe("deleteUserRole", () => {
    it("should delete an existing user-role relation", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await expect(deleteUserRole(4, 3)).resolves.toBeUndefined();
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM user_roles"), [4, 3]);
    });

    it("should throw USER_ROLE_NOT_FOUND when relation is missing", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(deleteUserRole(4, 3)).rejects.toThrow("USER_ROLE_NOT_FOUND");
    });
  });
});
