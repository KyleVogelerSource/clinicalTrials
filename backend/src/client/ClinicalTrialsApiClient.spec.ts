import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClinicalTrialsApiClient,
  ClinicalTrialsApiClientError,
  ClinicalTrialsApiTimeoutError,
} from "./ClinicalTrialsApiClient";

describe("ClinicalTrialsApiClient", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("builds the expected ClinicalTrials.gov URL with advanced filters", () => {
    const client = new ClinicalTrialsApiClient();

    const url = client.buildUrl({
      term: "diabetes",
      condition: "Type 2 Diabetes",
      intervention: "metformin",
      sponsor: "NIH",
      investigator: "Smith",
      location: "Boston",
      overallStatus: "RECRUITING",
      phase: "PHASE2",
      studyType: "INTERVENTIONAL",
      allocationType: "RANDOMIZED",
      interventionModel: "PARALLEL",
      blindingType: "DOUBLE",
      primaryPurpose: "TREATMENT",
      sex: "ALL",
      healthyVolunteers: false,
      hasResults: true,
      minAge: 18,
      maxAge: 65,
      minEnrollment: 100,
      maxEnrollment: 500,
      startDateFrom: "2024-01-01",
      startDateTo: "2024-12-31",
      completionDateFrom: "2025-01-01",
      completionDateTo: "2026-12-31",
      pageSize: 250,
      pageToken: "next-token",
      countTotal: true,
    });

    expect(url).toContain("query.term=%28diabetes%29+AND+");
    expect(url).toContain("query.cond=Type+2+Diabetes");
    expect(url).toContain("query.intr=metformin");
    expect(url).toContain("query.spons=NIH");
    expect(url).toContain("query.invest=Smith");
    expect(url).toContain("query.locn=Boston");
    expect(url).toContain("filter.overallStatus=RECRUITING");
    expect(url).toContain("query.term=%28diabetes%29+AND+%28AREA%5BPhase%5D%28PHASE2%29+AND+AREA%5BStudyType%5D%28INTERVENTIONAL%29+AND+AREA%5BDesignInterventionModel%5D%28PARALLEL%29+AND+AREA%5BDesignAllocation%5D%28RANDOMIZED%29+AND+AREA%5BDesignMasking%5D%28DOUBLE%29+AND+AREA%5BDesignPrimaryPurpose%5D%28TREATMENT%29+AND+AREA%5BSex%5DALL+AND+AREA%5BHealthyVolunteers%5DN+AND+AREA%5BHasResults%5DY+AND+AREA%5BMinimumAge%5DRANGE%5B18years%2C65years%5D+AND+AREA%5BEnrollmentCount%5DRANGE%5B100%2C500%5D+AND+AREA%5BStartDate%5DRANGE%5B2024-01-01%2C2024-12-31%5D+AND+AREA%5BCompletionDate%5DRANGE%5B2025-01-01%2C2026-12-31%5D%29");
    expect(url).toContain("pageSize=100");
    expect(url).toContain("pageToken=next-token");
    expect(url).toContain("countTotal=true");
    expect(url).toContain("fields=ProtocolSection,DerivedSection,HasResults");
  });

  it("builds the expected ClinicalTrials.gov URL with multi-select design filters", () => {
    const client = new ClinicalTrialsApiClient();

    const url = client.buildUrl({
      phase: "PHASE1 OR PHASE2",
      allocationType: "RANDOMIZED OR NA",
      interventionModel: "PARALLEL OR CROSSOVER",
      blindingType: "SINGLE OR DOUBLE",
    });

    expect(url).toContain("query.term=AREA%5BPhase%5D%28PHASE1+OR+PHASE2%29+AND+AREA%5BDesignInterventionModel%5D%28PARALLEL+OR+CROSSOVER%29+AND+AREA%5BDesignAllocation%5D%28RANDOMIZED+OR+NA%29+AND+AREA%5BDesignMasking%5D%28SINGLE+OR+DOUBLE%29");
  });

  it("returns mapped studies on a successful response", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        totalCount: 2,
        nextPageToken: "more",
        studies: [{ id: "A" }, { id: "B" }],
      }),
    });

    const client = new ClinicalTrialsApiClient({ timeoutMs: 50 });
    const result = await client.searchStudies({ condition: "Asthma" });

    expect(result).toEqual({
      totalCount: 2,
      nextPageToken: "more",
      studies: [{ id: "A" }, { id: "B" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("query.cond=Asthma");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Accept: "application/json" },
    });
  });

  it("returns an empty response shape for an unexpected payload", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    });

    const client = new ClinicalTrialsApiClient();
    const result = await client.searchStudies({});

    expect(result).toEqual({ totalCount: 0, studies: [] });
  });

  it("maps non-ok upstream responses to a client error", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: vi.fn().mockResolvedValue("upstream error"),
    });

    const client = new ClinicalTrialsApiClient();

    await expect(client.searchStudies({ term: "oncology" })).rejects.toMatchObject({
      name: "ClinicalTrialsApiClientError",
      message: "ClinicalTrials.gov API responded with status 502: Bad Gateway",
    });
  });

  it("maps abort failures to a timeout error", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValueOnce(abortError);

    const client = new ClinicalTrialsApiClient({ timeoutMs: 1234 });

    await expect(client.searchStudies({ term: "rare disease" })).rejects.toEqual(
      expect.objectContaining({
        name: "ClinicalTrialsApiTimeoutError",
        message: "Request timed out after 1234ms",
      })
    );
  });

  it("wraps other fetch failures with the original cause", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const networkError = new Error("socket hang up");
    fetchMock.mockRejectedValueOnce(networkError);

    const client = new ClinicalTrialsApiClient();

    await expect(client.searchStudies({ term: "cardiology" })).rejects.toEqual(
      expect.objectContaining({
        name: "ClinicalTrialsApiClientError",
        message: "Failed to fetch studies from ClinicalTrials.gov",
        cause: networkError,
      })
    );
  });

  it("uses the exported error classes", () => {
    const generic = new ClinicalTrialsApiClientError("boom");
    const timeout = new ClinicalTrialsApiTimeoutError(5000);

    expect(generic.name).toBe("ClinicalTrialsApiClientError");
    expect(timeout.name).toBe("ClinicalTrialsApiTimeoutError");
    expect(timeout.message).toBe("Request timed out after 5000ms");
  });
});
