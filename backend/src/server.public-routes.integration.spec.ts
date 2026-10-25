import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const mocks = vi.hoisted(() => ({
  searchAndBuildCandidatePool: vi.fn(),
  generateAIResults: vi.fn(),
  runBenchmarkPipeline: vi.fn(),
  probeDatabaseConnection: vi.fn(),
  isDatabaseConnected: vi.fn(),
  getAiProviderStatuses: vi.fn(),
}));

vi.mock("./services/ClinicalTrialsService", () => ({
  searchClinicalTrials: vi.fn(),
  createEmptyClinicalTrialStudiesResponse: () => ({ totalCount: 0, studies: [] }),
  searchAndBuildCandidatePool: mocks.searchAndBuildCandidatePool,
}));

vi.mock("./services/AIResultsService", () => ({
  generateAIResults: mocks.generateAIResults,
}));

vi.mock("./services/TrialBenchmarkPipeline", () => ({
  runBenchmarkPipeline: mocks.runBenchmarkPipeline,
}));

vi.mock("./services/AiProviderStatusService", () => ({
  getAiProviderStatuses: mocks.getAiProviderStatuses,
}));

vi.mock("./storage/PostgresClient", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnected: mocks.isDatabaseConnected,
  probeDatabaseConnection: mocks.probeDatabaseConnection,
}));

import { invokeExpressApp } from "./test/expressHarness";

describe("Server public route coverage", () => {
  let app: Express;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("VOYAGE_API_KEY", "");
    mocks.isDatabaseConnected.mockReturnValue(true);
    mocks.probeDatabaseConnection.mockResolvedValue({
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
    });
    mocks.getAiProviderStatuses.mockResolvedValue({
      anthropic: { configured: true, reachable: true, checkedAt: "2026-04-10T00:00:00.000Z", error: null },
      voyage: { configured: true, reachable: true, checkedAt: "2026-04-10T00:00:00.000Z", error: null },
    });
    ({ app } = await import("./server"));
  });

  it("handles CORS preflight for allowed origins", async () => {
    const res = await invokeExpressApp(app, {
      method: "OPTIONS",
      url: "/api/clinical-trials/search",
      headers: { origin: "http://localhost:4200" },
    });

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("sets CORS headers for allowed non-preflight requests", async () => {
    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/health",
      headers: { origin: "https://cardinaltrials.com" },
    });

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://cardinaltrials.com");
  });

  it("returns debug status without a database failure message when diagnostics are healthy", async () => {
    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/debug/status",
    });

    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).databaseFailureMessage).toBeNull();
    expect(mocks.getAiProviderStatuses).toHaveBeenCalledWith({ forceRefresh: false });
  });

  it("formats debug database failures without optional code detail or hint", async () => {
    mocks.isDatabaseConnected.mockReturnValue(false);
    mocks.probeDatabaseConnection.mockResolvedValueOnce({
      connected: false,
      checkedAt: "2026-04-10T00:00:00.000Z",
      configuration: {
        host: "db.example.test",
        port: 5432,
        database: "clinicaltrials",
        user: "app",
        ssl: { enabled: true },
      },
      lastSuccessfulConnectionAt: "2026-04-09T00:00:00.000Z",
      failure: {
        capturedAt: "2026-04-10T00:00:00.000Z",
        operation: "connect",
        name: "DbError",
        message: "timeout",
      },
    });

    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/debug/status",
    });

    expect(res.status).toBe(200);
    expect((res.body as Record<string, string>).databaseFailureMessage).toContain("Last successful connection at 2026-04-09T00:00:00.000Z.");
    expect((res.body as Record<string, string>).databaseFailureMessage).not.toContain("Code:");
  });

  it("returns debug status with database failure details and refreshed AI provider status", async () => {
    mocks.isDatabaseConnected.mockReturnValue(false);
    mocks.probeDatabaseConnection.mockResolvedValueOnce({
      connected: false,
      checkedAt: "2026-04-10T00:00:00.000Z",
      configuration: {
        host: "db.example.test",
        port: 5432,
        database: "clinicaltrials",
        user: "app",
        ssl: { enabled: true },
      },
      lastSuccessfulConnectionAt: null,
      failure: {
        capturedAt: "2026-04-10T00:00:00.000Z",
        operation: "connect",
        name: "DbError",
        message: "timeout",
        code: "ETIMEDOUT",
        detail: "network unavailable",
        hint: "check security group",
      },
    });

    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/debug/status?refreshAiProviders=true",
    });

    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).databaseConnected).toBe(false);
    expect((res.body as Record<string, string>).databaseFailureMessage).toContain("Operation: connect.");
    expect(mocks.getAiProviderStatuses).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it("returns the empty clinical trials response helper payload", async () => {
    const res = await invokeExpressApp(app, {
      method: "GET",
      url: "/api/clinical-trials/empty-response",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ totalCount: 0, studies: [] });
  });

  it("builds a candidate pool with cap and reference trial options", async () => {
    mocks.searchAndBuildCandidatePool.mockResolvedValueOnce({
      trials: [],
      metadata: { totalFetchedFromApi: 1, totalPagesfetched: 1, totalFiltered: 0, totalExcluded: 0, totalInPool: 0, cappedAt: 5 },
    });

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/candidate-pool",
      body: {
        term: "diabetes",
        cap: 5,
        referenceTrial: { phase: "PHASE2" },
      },
    });

    expect(res.status).toBe(200);
    expect(mocks.searchAndBuildCandidatePool).toHaveBeenCalledWith(
      { term: "diabetes" },
      { cap: 5, referenceTrial: { phase: "PHASE2" } }
    );
  });

  it("validates candidate-pool requests and maps unexpected errors", async () => {
    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/candidate-pool",
      body: {},
    });
    expect(invalid.status).toBe(400);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.searchAndBuildCandidatePool.mockRejectedValueOnce(new Error("unexpected"));
    const unexpected = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/candidate-pool",
      body: { term: "diabetes" },
    });
    expect(unexpected.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/clinical-trials/candidate-pool:", expect.any(Error));
  });

  it("maps candidate-pool upstream errors through the shared API error handler", async () => {
    const { ClinicalTrialsApiClientError, ClinicalTrialsApiTimeoutError } = await import("./client/ClinicalTrialsApiClient");
    mocks.searchAndBuildCandidatePool.mockRejectedValueOnce(new ClinicalTrialsApiTimeoutError(2000));
    const timeout = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/candidate-pool",
      body: { term: "diabetes" },
    });
    expect(timeout.status).toBe(504);

    mocks.searchAndBuildCandidatePool.mockRejectedValueOnce(new ClinicalTrialsApiClientError("bad upstream"));
    const badGateway = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/candidate-pool",
      body: { term: "diabetes" },
    });
    expect(badGateway.status).toBe(502);
  });

  it("requires selected trials for AI results and returns generated results on success", async () => {
    const invalid = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/results",
      body: { condition: "diabetes", trials: [] },
    });
    expect(invalid.status).toBe(400);

    mocks.generateAIResults.mockResolvedValueOnce({ overallScore: 90, totalTrialsFound: 1 });
    const success = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/results",
      body: {
        condition: "diabetes",
        phase: null,
        allocationType: null,
        interventionModel: null,
        blindingType: null,
        minAge: null,
        maxAge: null,
        sex: null,
        selectedTrialIds: [],
        inclusionCriteria: [],
        exclusionCriteria: [],
        trials: [{ nctId: "NCT000001", briefTitle: "Trial" }],
      },
    });

    expect(success.status).toBe(200);
    expect(success.body).toEqual({ overallScore: 90, totalTrialsFound: 1 });
    expect(mocks.generateAIResults).toHaveBeenCalledWith(
      expect.objectContaining({ condition: "diabetes" }),
      [{ nctId: "NCT000001", briefTitle: "Trial" }]
    );
  });

  it("maps AI results errors to 500", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateAIResults.mockRejectedValueOnce(new Error("ai failed"));

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/results",
      body: {
        condition: "diabetes",
        trials: [{ nctId: "NCT000001", briefTitle: "Trial" }],
      },
    });

    expect(res.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/clinical-trials/results:", expect.any(Error));
  });

  it("validates benchmark configuration before running the pipeline", async () => {
    const noTrials = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/benchmark",
      body: { condition: "diabetes", trials: [] },
    });
    expect(noTrials.status).toBe(400);

    const noAnthropic = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/benchmark",
      body: { condition: "diabetes", trials: [{ nctId: "NCT000001" }] },
    });
    expect(noAnthropic.status).toBe(500);
    expect((noAnthropic.body as Record<string, unknown>).message).toBe("ANTHROPIC_API_KEY is not configured.");

    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    const noVoyage = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/benchmark",
      body: { condition: "diabetes", trials: [{ nctId: "NCT000001" }] },
    });
    expect(noVoyage.status).toBe(500);
    expect((noVoyage.body as Record<string, unknown>).message).toBe("VOYAGE_API_KEY is not configured.");
  });

  it("normalizes benchmark trials and passes API keys to the pipeline", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("VOYAGE_API_KEY", "voyage-key");
    mocks.runBenchmarkPipeline.mockResolvedValueOnce({ rankedTrials: [], totalCandidates: 1 });

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/benchmark",
      body: {
        condition: "diabetes",
        phase: null,
        allocationType: null,
        interventionModel: null,
        blindingType: null,
        minAge: null,
        maxAge: null,
        sex: null,
        selectedTrialIds: [],
        inclusionCriteria: [],
        exclusionCriteria: [],
        topK: 3,
        trials: [
          {
            protocolSection: {
              identificationModule: { nctId: "NCTRAW001", briefTitle: "Raw API trial" },
              statusModule: { overallStatus: "COMPLETED" },
              designModule: { studyType: "INTERVENTIONAL", phases: ["PHASE2"] },
              conditionsModule: { conditions: ["Diabetes"] },
            },
          },
          {
            nctId: "NCTPARTIAL001",
            briefTitle: "Partial trial",
            conditions: ["Diabetes"],
          },
        ],
        proposedTrial: { nctId: "NCTPROPOSED", briefTitle: "Proposed" },
      },
    });

    expect(res.status).toBe(200);
    expect(mocks.runBenchmarkPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ condition: "diabetes" }),
      [
        expect.objectContaining({ nctId: "NCTRAW001", briefTitle: "Raw API trial" }),
        expect.objectContaining({ nctId: "NCTPARTIAL001", phase: "UNKNOWN", sex: "ALL" }),
      ],
      expect.objectContaining({ nctId: "NCTPROPOSED", phase: "UNKNOWN" }),
      3,
      "anthropic-key",
      "voyage-key"
    );
  });

  it("uses benchmark defaults and maps pipeline errors", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("VOYAGE_API_KEY", "voyage-key");
    mocks.runBenchmarkPipeline.mockResolvedValueOnce({ rankedTrials: [], totalCandidates: 1 });

    const success = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/benchmark",
      body: {
        condition: "diabetes",
        trials: [{ nctId: "NCTPARTIAL001", briefTitle: "Partial trial" }],
      },
    });

    expect(success.status).toBe(200);
    expect(mocks.runBenchmarkPipeline).toHaveBeenLastCalledWith(
      expect.objectContaining({ condition: "diabetes" }),
      [expect.objectContaining({ nctId: "NCTPARTIAL001" })],
      null,
      15,
      "anthropic-key",
      "voyage-key"
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runBenchmarkPipeline.mockRejectedValueOnce(new Error("pipeline failed"));
    const failure = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/benchmark",
      body: {
        condition: "diabetes",
        trials: [{ nctId: "NCTPARTIAL001", briefTitle: "Partial trial" }],
      },
    });

    expect(failure.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Unexpected error in POST /api/clinical-trials/benchmark:", expect.any(Error));
  });
});
