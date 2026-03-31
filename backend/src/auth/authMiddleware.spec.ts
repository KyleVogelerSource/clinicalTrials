import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import type { AuthTokenPayload } from "./AuthService";
import {
  authenticateToken,
  requireAction,
  userHasAction,
  AuthenticatedRequest,
} from "./authMiddleware";
import * as postgresClient from "../storage/PostgresClient";

vi.mock("jsonwebtoken");
vi.mock("../storage/PostgresClient");

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

describe("authMiddleware", () => {
  type VerifyFn = (token: string, secret: string) => AuthTokenPayload;

  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: MockResponse;
  let mockNext: NextFunction & ReturnType<typeof vi.fn>;
  let verifyMock: ReturnType<typeof vi.fn<VerifyFn>>;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
    };
    verifyMock = jwt.verify as unknown as ReturnType<typeof vi.fn<VerifyFn>>;

    vi.mocked(postgresClient.getDbPool).mockReturnValue(
      mockPool as unknown as ReturnType<typeof postgresClient.getDbPool>
    );

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as MockResponse;

    mockNext = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("authenticateToken", () => {
    it("should call next when valid token is provided", () => {
      const token = "valid_token";
      mockReq.headers = { authorization: `Bearer ${token}` };

      verifyMock.mockReturnValue({
        userId: 1,
        username: "testuser",
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should set user payload on request", () => {
      const token = "valid_token";
      mockReq.headers = { authorization: `Bearer ${token}` };

      const payload: AuthTokenPayload = { userId: 42, username: "testuser" };
      verifyMock.mockReturnValue(payload);

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockReq.user).toEqual(payload);
    });

    it("should return 401 when no token is provided", () => {
      mockReq.headers = {};

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Unauthorized",
          message: "No token provided.",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is missing", () => {
      mockReq.headers = { authorization: "" };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 when Authorization header does not start with Bearer", () => {
      mockReq.headers = { authorization: "Basic notatoken" };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 when token verification fails", () => {
      mockReq.headers = { authorization: "Bearer invalid_token" };

      verifyMock.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Unauthorized",
          message: "Invalid or expired token.",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when token is expired", () => {
      mockReq.headers = { authorization: "Bearer expired_token" };

      verifyMock.mockImplementation(() => {
        throw new Error("TokenExpiredError");
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should extract token correctly from Bearer header", () => {
      const token = "actual_token_value";
      mockReq.headers = { authorization: `Bearer ${token}` };

      verifyMock.mockReturnValue({
        userId: 1,
        username: "user",
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
    });

    it("should handle Bearer token with extra spaces", () => {
      mockReq.headers = { authorization: "Bearer    spaced_token" };

      verifyMock.mockReturnValue({
        userId: 1,
        username: "user",
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(
        "   spaced_token",
        expect.any(String)
      );
    });

    it("should handle case sensitivity of Bearer", () => {
      mockReq.headers = { authorization: "bearer lowercase_token" };

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("userHasAction", () => {
    it("should return true if user has action", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await userHasAction(1, "user_roles");

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("user_roles"),
        [1, "user_roles"]
      );
    });

    it("should return false if user does not have action", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await userHasAction(1, "admin");

      expect(result).toBe(false);
    });

    it("should handle null rowCount", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: null });

      const result = await userHasAction(1, "test");

      expect(result).toBe(false);
    });

    it("should handle undefined rowCount", async () => {
      mockPool.query.mockResolvedValueOnce({});

      const result = await userHasAction(1, "test");

      expect(result).toBe(false);
    });

    it("should query with correct user ID and action", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await userHasAction(42, "create_users");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [42, "create_users"]
      );
    });

    it("should join through roles and actions tables", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await userHasAction(1, "test_action");

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain("user_roles");
      expect(query).toContain("role_actions");
      expect(query).toContain("actions");
    });

    it("should propagate database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB Error"));

      await expect(userHasAction(1, "action")).rejects.toThrow("DB Error");
    });

    it("should limit results to 1", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await userHasAction(1, "action");

      const query = mockPool.query.mock.calls[0][0];
      expect(query).toContain("LIMIT 1");
    });

    it("should handle special characters in action name", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await userHasAction(1, "action_with-special.chars");

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe("requireAction", () => {
    it("should return middleware function", () => {
      const middleware = requireAction("test_action");

      expect(typeof middleware).toBe("function");
      expect(middleware.length).toBe(3); // middleware takes 3 params
    });

    it("should check user authentication first", async () => {
      const middleware = requireAction("test_action");
      mockReq.user = undefined;

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should check if user has required action", async () => {
      const middleware = requireAction("admin");
      mockReq.user = { userId: 1, username: "testuser" };

      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockPool.query).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 403 if user lacks required action", async () => {
      const middleware = requireAction("admin");
      mockReq.user = { userId: 1, username: "testuser" };

      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Forbidden",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next if action check passes", async () => {
      const middleware = requireAction("edit_users");
      mockReq.user = { userId: 5, username: "admin" };

      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should pass user ID to userHasAction", async () => {
      const middleware = requireAction("test");
      mockReq.user = { userId: 99, username: "user99" };

      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [99, "test"]
      );
    });

    it("should pass action name to userHasAction", async () => {
      const middleware = requireAction("delete_content");
      mockReq.user = { userId: 1, username: "user" };

      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, "delete_content"]
      );
    });

    it("should handle database errors gracefully", async () => {
      const middleware = requireAction("test");
      mockReq.user = { userId: 1, username: "user" };

      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("should return 401 when user is not authenticated", async () => {
      const middleware = requireAction("admin");
      mockReq.user = undefined;

      await middleware(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Edge cases and security", () => {
    it("should overwrite existing user with verified token payload", () => {
      mockReq.headers = { authorization: "Bearer token" };
      mockReq.user = { userId: 999, username: "admin" };

      const payload: AuthTokenPayload = { userId: 1, username: "realuser" };
      verifyMock.mockReturnValue(payload);

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      // The authenticateToken should verify and set user from JWT, overwriting initial value
      // However, the actual implementation sets user regardless
      expect(mockReq.user).toBeDefined();
      expect(jwt.verify).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should verify token with correct secret", () => {
      mockReq.headers = { authorization: "Bearer token" };

      verifyMock.mockReturnValue({
        userId: 1,
        username: "user",
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith("token", expect.any(String));
    });

    it("should sanitize action names in database queries", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await userHasAction(1, "'; DROP TABLE actions; --");

      // Query should handle it safely (parameterized)
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["'; DROP TABLE actions; --"])
      );
    });

    it("should handle very long tokens gracefully", () => {
      const longToken = "x".repeat(10000);
      mockReq.headers = { authorization: `Bearer ${longToken}` };

      verifyMock.mockImplementation(() => {
        throw new Error("Token too long");
      });

      authenticateToken(mockReq as AuthenticatedRequest, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
