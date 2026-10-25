import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { invokeExpressApp } from "./test/expressHarness";

const mocks = vi.hoisted(() => ({
  isDatabaseConnected: vi.fn(),
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  userHasAction: vi.fn(),
  authenticateToken: vi.fn(),
}));

vi.mock("./storage/PostgresClient", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnected: mocks.isDatabaseConnected,
  probeDatabaseConnection: vi.fn().mockResolvedValue({
    connected: true,
    checkedAt: "2026-04-10T00:00:00.000Z",
    configuration: {
      host: "localhost",
      port: 5432,
      database: "clinicaltrials",
      user: "test",
      ssl: { enabled: false },
    },
    lastSuccessfulConnectionAt: "2026-04-10T00:00:00.000Z",
    failure: null,
  }),
}));

vi.mock("./auth/AuthService", () => ({
  registerUser: mocks.registerUser,
  loginUser: mocks.loginUser,
}));

vi.mock("./auth/authMiddleware", async () => {
  const actual = await vi.importActual<typeof import("./auth/authMiddleware")>("./auth/authMiddleware");
  return {
    ...actual,
    authenticateToken: mocks.authenticateToken,
    userHasAction: mocks.userHasAction,
  };
});

describe("Server auth route integration tests", () => {
  let app: Express;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isDatabaseConnected.mockReturnValue(true);
    mocks.authenticateToken.mockImplementation((req, _res, next) => {
      req.user = { userId: 42, username: "alice" };
      next();
    });
    ({ app } = await import("./server"));
  });

  it("returns 503 for database-backed auth routes when database is disconnected", async () => {
    mocks.isDatabaseConnected.mockReturnValue(false);

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: "alice", password: "secret" },
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: "Service Unavailable",
      message: "Database is unavailable. Retry when database connectivity is restored.",
    });
    expect(mocks.loginUser).not.toHaveBeenCalled();
  });

  it("validates register payloads and trims user fields on success", async () => {
    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: "alice", password: "", firstName: "Alice", lastName: "Tester" },
    });
    expect(invalid.status).toBe(400);

    mocks.registerUser.mockResolvedValueOnce({
      token: "jwt",
      username: "alice",
      firstName: "Alice",
      lastName: "Tester",
    });
    const success = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: " alice ", password: "secret", firstName: " Alice ", lastName: " Tester " },
    });

    expect(success.status).toBe(201);
    expect(mocks.registerUser).toHaveBeenCalledWith({
      username: "alice",
      password: "secret",
      firstName: "Alice",
      lastName: "Tester",
    });
  });

  it("maps register domain and unexpected errors", async () => {
    mocks.registerUser.mockRejectedValueOnce(new Error("USERNAME_TAKEN"));
    const conflict = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: "alice", password: "secret", firstName: "Alice", lastName: "Tester" },
    });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.registerUser.mockRejectedValueOnce(new Error("boom"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/register",
      body: { username: "bob", password: "secret", firstName: "Bob", lastName: "Tester" },
    });

    expect(conflict.status).toBe(409);
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/auth/register:", expect.any(Error));
  });

  it("validates login payloads, maps invalid credentials, and returns successful login", async () => {
    const invalidPayload = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: "", password: "secret" },
    });
    expect(invalidPayload.status).toBe(400);

    mocks.loginUser.mockRejectedValueOnce(new Error("INVALID_CREDENTIALS"));
    const invalidCredentials = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: "alice", password: "wrong" },
    });
    expect(invalidCredentials.status).toBe(401);

    mocks.loginUser.mockResolvedValueOnce({
      token: "jwt",
      username: "alice",
      firstName: "Alice",
      lastName: "Tester",
    });
    const success = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: " alice ", password: "secret" },
    });

    expect(success.status).toBe(200);
    expect(mocks.loginUser).toHaveBeenLastCalledWith({ username: "alice", password: "secret" });
  });

  it("maps unexpected login errors to 500", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.loginUser.mockRejectedValueOnce(new Error("login failed"));

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/auth/login",
      body: { username: "alice", password: "secret" },
    });

    expect(res.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/auth/login:", expect.any(Error));
  });

  it("returns action authorization status for authenticated users", async () => {
    mocks.userHasAction.mockResolvedValueOnce(true);

    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/auth/has-action/user_roles",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ action: "user_roles", allowed: true });
    expect(mocks.userHasAction).toHaveBeenCalledWith(42, "user_roles");
  });

  it("handles missing token user payload and action lookup failures", async () => {
    const missingAction = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/auth/has-action/%20",
    });
    expect(missingAction.status).toBe(400);

    mocks.authenticateToken.mockImplementationOnce((req, _res, next) => {
      req.user = undefined;
      next();
    });
    const missingUser = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/auth/has-action/user_roles",
    });
    expect(missingUser.status).toBe(401);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.userHasAction.mockRejectedValueOnce(new Error("lookup failed"));
    const lookupFailure = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/auth/has-action/user_roles",
    });

    expect(lookupFailure.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in GET /api/auth/has-action/:action:", expect.any(Error));
  });
});
