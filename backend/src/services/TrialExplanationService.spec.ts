import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialResultsRequest } from "../dto/TrialResultsRequest";
import { makeTrial } from "./TestHelpers";
import { generateExplanation } from "./TrialExplanationService";
import { OutlierDetectionResult } from "./TrialOutlierDetector";

describe("TrialExplanationService", () => {
  const fetchMock = vi.fn();
  const request: TrialResultsRequest = {
    condition: "Diabetes",
    phase: "PHASE2",
    allocationType: "RANDOMIZED",
    interventionModel: "PARALLEL",
    blindingType: "DOUBLE",
    minAge: 18,
    maxAge: 65,
    sex: "ALL",
    selectedTrialIds: [],
    inclusionCriteria: [],
    exclusionCriteria: [],
  };
  const outliers: OutlierDetectionResult = {
    numeric: [
      {
        attribute: "enrollmentCount",
        proposedValue: 500,
        poolMin: 10,
        poolMax: 400,
        poolMedian: 120,
        poolMean: 130,
        poolP25: 80,
        poolP75: 220,
        proposedPercentile: 95,
        outlier: "HIGH",
        insufficientData: false,
      },
    ],
    categorical: [
      {
        attribute: "phase",
        proposedValue: "PHASE3",
        poolFrequency: { PHASE2: 9, PHASE3: 1 },
        proposedFrequencyPct: 10,
        uncommon: true,
        insufficientData: false,
      },
    ],
    thresholds: { lowerPercentile: 10, upperPercentile: 90, minPoolSize: 10 },
    poolSize: 10,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("returns the default explanation without calling Anthropic when there are no top trials", async () => {
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateExplanation(request, [], outliers, "anthropic-key");

    expect(result.explanation).toContain("No similar historical trials were found");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a grounded prompt and joins text blocks from a successful Anthropic response", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [
          { type: "text", text: "First paragraph. " },
          { type: "tool_use", text: "ignored" },
          { type: "text", text: "Second paragraph." },
        ],
      }),
    });

    const result = await generateExplanation(
      request,
      [{ trial: makeTrial({ nctId: "NCT000001", briefTitle: "Diabetes trial" }), similarityScore: 0.91, rank: 1 }],
      outliers,
      "anthropic-key"
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(result.explanation).toBe("First paragraph. Second paragraph.");
    expect(body.messages[0].content).toContain("Diabetes trial (NCT000001)");
    expect(body.messages[0].content).toContain("enrollmentCount is HIGH (95th percentile)");
    expect(body.messages[0].content).toContain("phase \"PHASE3\" is uncommon");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "anthropic-key" }),
      })
    );
  });

  it("includes a small-pool caution note when outlier flags are suppressed", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "Done." }] }),
    });

    await generateExplanation(
      request,
      [{ trial: makeTrial({ nctId: "NCT000002" }), similarityScore: 0.8, rank: 1 }],
      { ...outliers, poolSize: 3 },
      "anthropic-key"
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("pool contains only 3 trials");
    expect(body.messages[0].content).toContain("Statistical outlier flags have been suppressed");
  });

  it("throws a descriptive error for non-ok Anthropic responses", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("rate limited"),
    });

    await expect(
      generateExplanation(
        request,
        [{ trial: makeTrial({ nctId: "NCT000003" }), similarityScore: 0.8, rank: 1 }],
        outliers,
        "anthropic-key"
      )
    ).rejects.toThrow("Anthropic API error 429: rate limited");
  });
});
