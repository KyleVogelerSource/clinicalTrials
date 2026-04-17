import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const { searchClinicalTrialsMock } = vi.hoisted(() => ({
  searchClinicalTrialsMock: vi.fn(),
}));

vi.mock("./services/ClinicalTrialsService", () => ({
  searchClinicalTrials: searchClinicalTrialsMock,
  createEmptyClinicalTrialStudiesResponse: () => ({ totalCount: 0, studies: [] }),
  searchAndBuildCandidatePool: vi.fn(),
}));

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

import { invokeExpressApp } from "./test/expressHarness";

describe("Server functional API tests", () => {
  let app: Express;
  let ClinicalTrialsApiClientError: typeof import("./client/ClinicalTrialsApiClient").ClinicalTrialsApiClientError;
  let ClinicalTrialsApiTimeoutError: typeof import("./client/ClinicalTrialsApiClient").ClinicalTrialsApiTimeoutError;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ app } = await import("./server"));
    ({ ClinicalTrialsApiClientError, ClinicalTrialsApiTimeoutError } = await import("./client/ClinicalTrialsApiClient"));
  });

  it("returns health status", async () => {
    const res = await invokeExpressApp(app, { method: "GET", url: "/api/health" });

    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).ok).toBe(true);
    expect((res.body as Record<string, unknown>).message).toBe("API is running");
  });

  it("returns validation errors for invalid search payload", async () => {
    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/search",
      body: {},
    });

    expect(res.status).toBe(400);
    expect((res.body as Record<string, unknown>).error).toBe("Bad Request");
    expect(searchClinicalTrialsMock).not.toHaveBeenCalled();
  });

  it("maps upstream timeout errors to 504", async () => {
    searchClinicalTrialsMock.mockRejectedValueOnce(new ClinicalTrialsApiTimeoutError(1000));

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/search",
      body: { term: "diabetes" },
    });

    expect(res.status).toBe(504);
    expect((res.body as Record<string, unknown>).error).toBe("Gateway Timeout");
  });

  it("maps upstream client errors to 502", async () => {
    searchClinicalTrialsMock.mockRejectedValueOnce(new ClinicalTrialsApiClientError("Upstream failed"));

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/search",
      body: { term: "oncology" },
    });

    expect(res.status).toBe(502);
    expect((res.body as Record<string, unknown>).error).toBe("Bad Gateway");
  });

  it("returns clinical trials payload on success", async () => {
    searchClinicalTrialsMock.mockResolvedValueOnce({
      totalCount: 1,
      studies: [{ protocolSection: { identificationModule: { nctId: "NCT001", briefTitle: "Study" } } }],
    });

    const res = await invokeExpressApp(app, {
      method: "POST",
      url: "/api/clinical-trials/search",
      body: { term: "heart failure" },
    });

    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).totalCount).toBe(1);
    expect((res.body as Record<string, unknown>).studies).toHaveLength(1);
  });
});
