import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { invokeExpressApp } from "./test/expressHarness";

const mocks = vi.hoisted(() => ({
  authenticateToken: vi.fn(),
  requireAction: vi.fn(),
  userHasAction: vi.fn(),
  compareTrials: vi.fn(),
  createSavedSearch: vi.fn(),
  listOwnedSavedSearches: vi.fn(),
  listSharedSavedSearches: vi.fn(),
  getAccessibleSavedSearch: vi.fn(),
  updateAccessibleSavedSearch: vi.fn(),
  deleteOwnedSavedSearch: vi.fn(),
  shareSavedSearch: vi.fn(),
  runSavedSearch: vi.fn(),
}));

vi.mock("./storage/PostgresClient", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
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

vi.mock("./auth/authMiddleware", async () => {
  const actual = await vi.importActual<typeof import("./auth/authMiddleware")>("./auth/authMiddleware");
  return {
    ...actual,
    authenticateToken: mocks.authenticateToken,
    requireAction: mocks.requireAction,
    userHasAction: mocks.userHasAction,
  };
});

vi.mock("./services/TrialCompareService", () => ({
  compareTrials: mocks.compareTrials,
}));

vi.mock("./services/SavedSearchService", () => ({
  createSavedSearch: mocks.createSavedSearch,
  listOwnedSavedSearches: mocks.listOwnedSavedSearches,
  listSharedSavedSearches: mocks.listSharedSavedSearches,
  getAccessibleSavedSearch: mocks.getAccessibleSavedSearch,
  updateAccessibleSavedSearch: mocks.updateAccessibleSavedSearch,
  deleteOwnedSavedSearch: mocks.deleteOwnedSavedSearch,
  shareSavedSearch: mocks.shareSavedSearch,
  runSavedSearch: mocks.runSavedSearch,
}));

describe("Server saved search and compare route integration tests", () => {
  let app: Express;

  const validUpsert = {
    name: "Diabetes",
    description: null,
    visibility: "private",
    criteriaJson: { condition: "diabetes" },
  };

  const savedSearch = {
    id: 12,
    ownerUserId: 42,
    ownerUsername: "alice",
    name: "Diabetes",
    description: null,
    visibility: "private",
    criteriaJson: { condition: "diabetes" },
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.authenticateToken.mockImplementation((req, _res, next) => {
      req.user = { userId: 42, username: "alice" };
      next();
    });
    mocks.requireAction.mockImplementation(() => (_req, _res, next) => next());
    mocks.userHasAction.mockResolvedValue(true);
    ({ app } = await import("./server"));
  });

  it("validates and runs trial compare requests", async () => {
    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/compare",
      body: { trials: [{ nctId: "NCT1" }] },
    });
    expect(invalid.status).toBe(400);

    mocks.compareTrials.mockResolvedValueOnce({ normalizedTrials: [], comparisonMatrix: [], benchmarkScores: [] });
    const success = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/compare",
      body: { trials: [{ nctId: "NCT1" }, { nctId: "NCT2" }] },
    });
    expect(success.status).toBe(200);
    expect(mocks.compareTrials).toHaveBeenCalledWith({ trials: [{ nctId: "NCT1" }, { nctId: "NCT2" }] });

    mocks.compareTrials.mockRejectedValueOnce(new Error("TRIAL_NOT_FOUND:NCT404"));
    const notFound = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/compare",
      body: { trials: [{ nctId: "NCT1" }, { nctId: "NCT404" }] },
    });
    expect(notFound.status).toBe(404);
    expect(notFound.body).toEqual({ error: "Not Found", message: "Trial not found: NCT404" });

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.compareTrials.mockRejectedValueOnce(new Error("compare failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/compare",
      body: { trials: [{ nctId: "NCT1" }, { nctId: "NCT2" }] },
    });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/clinical-trials/compare:", expect.any(Error));
  });

  it("creates saved searches and maps validation and duplicate errors", async () => {
    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches",
      body: { name: "", visibility: "private", criteriaJson: { condition: "diabetes" } },
    });
    expect(invalid.status).toBe(400);

    mocks.createSavedSearch.mockResolvedValueOnce(savedSearch);
    const created = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches",
      body: validUpsert,
    });
    expect(created.status).toBe(201);
    expect(mocks.createSavedSearch).toHaveBeenCalledWith(42, "alice", validUpsert);

    mocks.createSavedSearch.mockRejectedValueOnce(new Error("DUPLICATE_SAVED_SEARCH"));
    const duplicate = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches",
      body: validUpsert,
    });
    expect(duplicate.status).toBe(409);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createSavedSearch.mockRejectedValueOnce(new Error("create failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches",
      body: validUpsert,
    });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/saved-searches:", expect.any(Error));

    mocks.authenticateToken.mockImplementationOnce((req, _res, next) => {
      req.user = { userId: 42 };
      next();
    });
    mocks.createSavedSearch.mockResolvedValueOnce(savedSearch);
    const missingUsername = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches",
      body: validUpsert,
    });
    expect(missingUsername.status).toBe(201);
    expect(mocks.createSavedSearch).toHaveBeenLastCalledWith(42, "", validUpsert);
  });

  it("lists owned and shared saved searches, including no-permission shared list fallback", async () => {
    mocks.listOwnedSavedSearches.mockResolvedValueOnce([savedSearch]);
    const owned = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches" });
    expect(owned.status).toBe(200);
    expect(owned.body).toEqual([savedSearch]);

    mocks.userHasAction.mockResolvedValueOnce(false);
    const noSharedPermission = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/shared-with-me" });
    expect(noSharedPermission.status).toBe(200);
    expect(noSharedPermission.body).toEqual([]);
    expect(mocks.listSharedSavedSearches).not.toHaveBeenCalled();

    mocks.userHasAction.mockResolvedValueOnce(true);
    mocks.listSharedSavedSearches.mockResolvedValueOnce([savedSearch]);
    const shared = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/shared-with-me" });
    expect(shared.status).toBe(200);
    expect(shared.body).toEqual([savedSearch]);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listOwnedSavedSearches.mockRejectedValueOnce(new Error("owned failed"));
    const ownedFailure = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches" });
    expect(ownedFailure.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in GET /api/saved-searches:", expect.any(Error));

    mocks.userHasAction.mockRejectedValueOnce(new Error("shared failed"));
    const sharedFailure = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/shared-with-me" });
    expect(sharedFailure.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in GET /api/saved-searches/shared-with-me:", expect.any(Error));
  });

  it("gets saved searches by id with id validation and not-found mapping", async () => {
    const invalid = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/not-a-number" });
    expect(invalid.status).toBe(400);

    mocks.getAccessibleSavedSearch.mockResolvedValueOnce(null);
    const missing = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/12" });
    expect(missing.status).toBe(404);

    mocks.getAccessibleSavedSearch.mockResolvedValueOnce(savedSearch);
    const found = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/12" });
    expect(found.status).toBe(200);
    expect(mocks.getAccessibleSavedSearch).toHaveBeenLastCalledWith(12, 42, true);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getAccessibleSavedSearch.mockRejectedValueOnce(new Error("get failed"));
    const unexpected = await invokeExpressApp(app, { method: "GET", url: "/api/saved-searches/12" });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in GET /api/saved-searches/:id:", expect.any(Error));
  });

  it("updates saved searches and maps domain errors", async () => {
    mocks.updateAccessibleSavedSearch.mockResolvedValueOnce({ ...savedSearch, name: "Updated" });
    const updated = await invokeExpressApp(app, {
      method: "PUT",
      url: "/api/saved-searches/12",
      body: { ...validUpsert, name: "Updated" },
    });
    expect(updated.status).toBe(200);
    expect(mocks.updateAccessibleSavedSearch).toHaveBeenCalledWith(
      12,
      42,
      { ...validUpsert, name: "Updated" },
      false,
      true
    );

    for (const [message, status] of [
      ["SAVED_SEARCH_NOT_FOUND", 404],
      ["SAVED_SEARCH_FORBIDDEN", 403],
      ["DUPLICATE_SAVED_SEARCH", 409],
    ] as const) {
      mocks.updateAccessibleSavedSearch.mockRejectedValueOnce(new Error(message));
      const res = await invokeExpressApp(app, {
        method: "PUT",
        url: "/api/saved-searches/12",
        body: validUpsert,
      });
      expect(res.status).toBe(status);
    }

    const invalidId = await invokeExpressApp(app, {
      method: "PUT",
      url: "/api/saved-searches/not-a-number",
      body: validUpsert,
    });
    expect(invalidId.status).toBe(400);

    const invalidBody = await invokeExpressApp(app, {
      method: "PUT",
      url: "/api/saved-searches/12",
      body: { name: "", visibility: "private", criteriaJson: { condition: "diabetes" } },
    });
    expect(invalidBody.status).toBe(400);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.updateAccessibleSavedSearch.mockRejectedValueOnce(new Error("update failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "PUT",
      url: "/api/saved-searches/12",
      body: validUpsert,
    });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in PUT /api/saved-searches/:id:", expect.any(Error));
  });

  it("deletes saved searches and maps ownership errors", async () => {
    mocks.deleteOwnedSavedSearch.mockResolvedValueOnce(undefined);
    const deleted = await invokeExpressApp(app, { method: "DELETE", url: "/api/saved-searches/12" });
    expect(deleted.status).toBe(204);

    mocks.deleteOwnedSavedSearch.mockRejectedValueOnce(new Error("SAVED_SEARCH_NOT_FOUND"));
    const missing = await invokeExpressApp(app, { method: "DELETE", url: "/api/saved-searches/12" });
    expect(missing.status).toBe(404);

    mocks.deleteOwnedSavedSearch.mockRejectedValueOnce(new Error("SAVED_SEARCH_FORBIDDEN"));
    const forbidden = await invokeExpressApp(app, { method: "DELETE", url: "/api/saved-searches/12" });
    expect(forbidden.status).toBe(403);

    const invalidId = await invokeExpressApp(app, { method: "DELETE", url: "/api/saved-searches/not-a-number" });
    expect(invalidId.status).toBe(400);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deleteOwnedSavedSearch.mockRejectedValueOnce(new Error("delete failed"));
    const unexpected = await invokeExpressApp(app, { method: "DELETE", url: "/api/saved-searches/12" });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in DELETE /api/saved-searches/:id:", expect.any(Error));
  });

  it("shares saved searches and maps target/domain errors", async () => {
    const shareRequest = { username: "bob", canView: true, canRun: false, canEdit: false };
    mocks.shareSavedSearch.mockResolvedValueOnce({ savedSearchId: 12, userId: 9, username: "bob", canView: true, canRun: false, canEdit: false, createdAt: "now" });
    const shared = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches/12/share",
      body: shareRequest,
    });
    expect(shared.status).toBe(200);
    expect(mocks.shareSavedSearch).toHaveBeenCalledWith(12, 42, shareRequest);

    for (const [message, status] of [
      ["SAVED_SEARCH_NOT_FOUND", 404],
      ["SAVED_SEARCH_FORBIDDEN", 403],
      ["TARGET_USER_NOT_FOUND", 404],
      ["TARGET_USER_INVALID", 400],
    ] as const) {
      mocks.shareSavedSearch.mockRejectedValueOnce(new Error(message));
      const res = await invokeExpressApp(app, {
        method: "POST",
        url: "/api/saved-searches/12/share",
        body: shareRequest,
      });
      expect(res.status).toBe(status);
    }

    const invalidId = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches/not-a-number/share",
      body: shareRequest,
    });
    expect(invalidId.status).toBe(400);

    const invalidBody = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches/12/share",
      body: { username: "", canView: false, canRun: false, canEdit: false },
    });
    expect(invalidBody.status).toBe(400);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.shareSavedSearch.mockRejectedValueOnce(new Error("share failed"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/saved-searches/12/share",
      body: shareRequest,
    });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/saved-searches/:id/share:", expect.any(Error));
  });

  it("runs saved searches and maps saved-search criteria errors", async () => {
    mocks.runSavedSearch.mockResolvedValueOnce({ savedSearch, run: { id: 1 }, results: { totalCount: 1, studies: [] } });
    const success = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/12/run" });
    expect(success.status).toBe(200);
    expect(mocks.runSavedSearch).toHaveBeenCalledWith(12, 42, true, false);

    mocks.runSavedSearch.mockRejectedValueOnce(new Error("SAVED_SEARCH_CRITERIA_INVALID:[{\"field\":\"term\",\"message\":\"required\"}]"));
    const invalidCriteria = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/12/run" });
    expect(invalidCriteria.status).toBe(400);
    expect((invalidCriteria.body as Record<string, unknown>).details).toEqual([{ field: "term", message: "required" }]);

    mocks.runSavedSearch.mockRejectedValueOnce(new Error("SAVED_SEARCH_NOT_FOUND"));
    const missing = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/12/run" });
    expect(missing.status).toBe(404);

    mocks.runSavedSearch.mockRejectedValueOnce(new Error("SAVED_SEARCH_FORBIDDEN"));
    const forbidden = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/12/run" });
    expect(forbidden.status).toBe(403);

    mocks.runSavedSearch.mockRejectedValueOnce(new Error("SAVED_SEARCH_CRITERIA_INVALID:not-json"));
    const invalidCriteriaFallback = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/12/run" });
    expect(invalidCriteriaFallback.status).toBe(400);
    expect((invalidCriteriaFallback.body as Record<string, unknown>).details).toEqual([]);

    const invalidId = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/not-a-number/run" });
    expect(invalidId.status).toBe(400);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runSavedSearch.mockRejectedValueOnce(new Error("run failed"));
    const unexpected = await invokeExpressApp(app, { method: "POST", url: "/api/saved-searches/12/run" });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/saved-searches/:id/run:", expect.any(Error));
  });

  it("returns 401 when protected saved-search routes have no user payload", async () => {
    for (const request of [
      { method: "POST", url: "/api/saved-searches", body: validUpsert },
      { method: "GET", url: "/api/saved-searches" },
      { method: "GET", url: "/api/saved-searches/shared-with-me" },
      { method: "GET", url: "/api/saved-searches/12" },
      { method: "PUT", url: "/api/saved-searches/12", body: validUpsert },
      { method: "DELETE", url: "/api/saved-searches/12" },
      { method: "POST", url: "/api/saved-searches/12/share", body: { username: "bob", canView: true, canRun: false, canEdit: false } },
      { method: "POST", url: "/api/saved-searches/12/run" },
    ]) {
      mocks.authenticateToken.mockImplementationOnce((req, _res, next) => {
        req.user = undefined;
        next();
      });

      const res = await invokeExpressApp(app, request);
      expect(res.status).toBe(401);
    }
  });
});
