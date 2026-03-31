import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as authService from "./AuthService";
import * as postgresClient from "../storage/PostgresClient";

vi.mock("bcryptjs");
vi.mock("jsonwebtoken");
vi.mock("../storage/PostgresClient", () => ({
  getDbPool: vi.fn(),
}));

describe("AuthService", () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    vi.mocked(postgresClient.getDbPool).mockReturnValue(mockPool);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createUserAccount", () => {
    it("should create a new user successfully", async () => {
      const input = {
        username: "testuser",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 }) // No existing user
        .mockResolvedValueOnce({
          // Insert result
          rows: [
            {
              id: 1,
              username: "testuser",
              first_name: "John",
              last_name: "Doe",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_password_123");

      const result = await authService.createUserAccount(input);

      expect(result).toEqual({
        id: 1,
        username: "testuser",
        firstName: "John",
        lastName: "Doe",
      });

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 12);
    });

    it("should throw error if username already exists", async () => {
      const input = {
        username: "existinguser",
        password: "password123",
        firstName: "Jane",
        lastName: "Doe",
      };

      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // User exists

      await expect(authService.createUserAccount(input)).rejects.toThrow(
        "USERNAME_TAKEN"
      );
    });

    it("should hash password with bcrypt", async () => {
      const input = {
        username: "newuser",
        password: "securepass",
        firstName: "Bob",
        lastName: "Smith",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              username: "newuser",
              first_name: "Bob",
              last_name: "Smith",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_value");

      await authService.createUserAccount(input);

      expect(bcrypt.hash).toHaveBeenCalledWith("securepass", 12);
    });

    it("should call database with correct insert query", async () => {
      const input = {
        username: "querytest",
        password: "pass123",
        firstName: "Test",
        lastName: "User",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            { id: 3, username: "querytest", first_name: "Test", last_name: "User" },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed");

      await authService.createUserAccount(input);

      const insertCall = mockPool.query.mock.calls[1];
      expect(insertCall[0]).toContain("INSERT INTO users");
      expect(insertCall[1]).toEqual(["querytest", "hashed", "Test", "User"]);
    });
  });

  describe("registerUser", () => {
    it("should register user and return token", async () => {
      const input = {
        username: "newuser",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "newuser",
              first_name: "John",
              last_name: "Doe",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_password");
      vi.mocked(jwt.sign).mockReturnValue("test_jwt_token" as unknown as string);

      const result = await authService.registerUser(input);

      expect(result).toEqual({
        token: "test_jwt_token",
        username: "newuser",
        firstName: "John",
        lastName: "Doe",
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 1, username: "newuser" },
        expect.any(String),
        { expiresIn: "1h" }
      );
    });

    it("should throw error if registration fails", async () => {
      const input = {
        username: "duplicate",
        password: "password123",
        firstName: "Jane",
        lastName: "Doe",
      };

      mockPool.query.mockResolvedValueOnce({ rowCount: 1 }); // User exists

      await expect(authService.registerUser(input)).rejects.toThrow();
    });

    it("should create token with correct expiration", async () => {
      const input = {
        username: "tokentest",
        password: "pass123",
        firstName: "Token",
        lastName: "User",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 5,
              username: "tokentest",
              first_name: "Token",
              last_name: "User",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed");
      vi.mocked(jwt.sign).mockReturnValue("token" as unknown as string);

      await authService.registerUser(input);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        { expiresIn: "1h" }
      );
    });
  });

  describe("loginUser", () => {
    it("should login user and return token", async () => {
      const input = {
        username: "testuser",
        password: "password123",
      };

      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 1,
            username: "testuser",
            password_hash: "hashed_password",
            first_name: "John",
            last_name: "Doe",
          },
        ],
      });

      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(jwt.sign).mockReturnValue("login_token" as unknown as string);

      const result = await authService.loginUser(input);

      expect(result).toEqual({
        token: "login_token",
        username: "testuser",
        firstName: "John",
        lastName: "Doe",
      });

      expect(bcrypt.compare).toHaveBeenCalledWith("password123", "hashed_password");
    });

    it("should throw error if user not found", async () => {
      const input = {
        username: "nonexistent",
        password: "password123",
      };

      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await expect(authService.loginUser(input)).rejects.toThrow("INVALID_CREDENTIALS");
    });

    it("should throw error if password is incorrect", async () => {
      const input = {
        username: "testuser",
        password: "wrongpassword",
      };

      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 1,
            username: "testuser",
            password_hash: "hashed_password",
            first_name: "John",
            last_name: "Doe",
          },
        ],
      });

      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(authService.loginUser(input)).rejects.toThrow("INVALID_CREDENTIALS");
    });

    it("should query database with correct SQL", async () => {
      const input = {
        username: "sqltest",
        password: "pass123",
      };

      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      try {
        await authService.loginUser(input);
      } catch {
        // Expected to fail
      }

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, username, password_hash"),
        ["sqltest"]
      );
    });

    it("should return correct user info from database", async () => {
      const input = {
        username: "infousertest",
        password: "pass456",
      };

      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 99,
            username: "infousertest",
            password_hash: "hashed",
            first_name: "Test",
            last_name: "Person",
          },
        ],
      });

      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(jwt.sign).mockReturnValue("token" as unknown as string);

      const result = await authService.loginUser(input);

      expect(result.firstName).toBe("Test");
      expect(result.lastName).toBe("Person");
      expect(result.username).toBe("infousertest");
    });

    it("should create token with correct user ID", async () => {
      const input = {
        username: "tokenidtest",
        password: "pass789",
      };

      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 42,
            username: "tokenidtest",
            password_hash: "hashed",
            first_name: "Token",
            last_name: "Id",
          },
        ],
      });

      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(jwt.sign).mockReturnValue("authtoken" as unknown as string);

      await authService.loginUser(input);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 42, username: "tokenidtest" },
        expect.any(String),
        { expiresIn: "1h" }
      );
    });
  });

  describe("Edge cases", () => {
    it("should handle special characters in username", async () => {
      const input = {
        username: "user@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "user@example.com",
              first_name: "John",
              last_name: "Doe",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed");

      const result = await authService.createUserAccount(input);

      expect(result.username).toBe("user@example.com");
    });

    it("should handle long passwords", async () => {
      const input = {
        username: "longpassuser",
        password:
          "a".repeat(200) +
          "!@#$%^&*()" +
          "b".repeat(200),
        firstName: "Long",
        lastName: "Pass",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "longpassuser",
              first_name: "Long",
              last_name: "Pass",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed");

      const result = await authService.createUserAccount(input);

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(result.username).toBe("longpassuser");
    });

    it("should handle names with special characters", async () => {
      const input = {
        username: "specialnameuser",
        password: "pass123",
        firstName: "José",
        lastName: "García-López",
      };

      mockPool.query
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              username: "specialnameuser",
              first_name: "José",
              last_name: "García-López",
            },
          ],
        });

      vi.mocked(bcrypt.hash).mockResolvedValue("hashed");

      const result = await authService.createUserAccount(input);

      expect(result.firstName).toBe("José");
      expect(result.lastName).toBe("García-López");
    });
  });
});
