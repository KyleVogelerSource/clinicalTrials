import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { ClinicalTrialsApiClientError, ClinicalTrialsApiTimeoutError } from "./client/ClinicalTrialsApiClient";
import { app } from "./server";

describe("Server functional API tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns health status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toBe("API is running");
  });

  it("returns validation errors for invalid search payload", async () => {
    const res = await request(app)
      .post("/api/clinical-trials/search")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Bad Request");
    expect(searchClinicalTrialsMock).not.toHaveBeenCalled();
  });

  it("maps upstream timeout errors to 504", async () => {
    searchClinicalTrialsMock.mockRejectedValueOnce(new ClinicalTrialsApiTimeoutError(1000));

    const res = await request(app)
      .post("/api/clinical-trials/search")
      .send({ term: "diabetes" });

    expect(res.status).toBe(504);
    expect(res.body.error).toBe("Gateway Timeout");
  });

  it("maps upstream client errors to 502", async () => {
    searchClinicalTrialsMock.mockRejectedValueOnce(new ClinicalTrialsApiClientError("Upstream failed"));

    const res = await request(app)
      .post("/api/clinical-trials/search")
      .send({ term: "oncology" });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("Bad Gateway");
  });

  it("returns clinical trials payload on success", async () => {
    searchClinicalTrialsMock.mockResolvedValueOnce({
      totalCount: 1,
      studies: [{ protocolSection: { identificationModule: { nctId: "NCT001", briefTitle: "Study" } } }],
    });

    const res = await request(app)
      .post("/api/clinical-trials/search")
      .send({ term: "heart failure" });

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.studies).toHaveLength(1);
  });
});
