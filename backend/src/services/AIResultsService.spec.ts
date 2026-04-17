import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAIResults } from "./AIResultsService";
import { TrialResultsRequest } from "../dto/TrialResultsRequest";
import { NormalizedTrial } from "../models/NormalizedTrial";

describe("generateAIResults", () => {
  const fetchMock = vi.fn();

  const request: TrialResultsRequest = {
    condition: "Type 2 Diabetes",
    phase: "Phase 2",
    allocationType: "Randomized",
    interventionModel: "Parallel Assignment",
    blindingType: "Double",
    minAge: 18,
    maxAge: 65,
    sex: "All",
    requiredConditions: [],
    ineligibleConditions: [],
    selectedTrialIds: ["NCT0001"],
  };

  const trials: NormalizedTrial[] = [
    {
      nctId: "NCT0001",
      briefTitle: "Study 1",
      phase: "Phase 2",
      studyType: "Interventional",
      overallStatus: "Completed",
      enrollmentCount: 120,
      enrollmentType: "ACTUAL",
      startDate: "2024-01-01",
      completionDate: "2024-12-31",
      conditions: ["Type 2 Diabetes"],
      interventions: ["Drug A"],
      eligibilityCriteria: "Adults with Type 2 Diabetes",
      sex: "All",
      minimumAge: "18 Years",
      maximumAge: "65 Years",
      primaryOutcomes: ["A1C change"],
      sponsor: "NIH",
    },
  ];

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("parses a successful Anthropic response with fenced JSON", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: '```json\n{"overallScore":88,"totalTrialsFound":1,"queryCondition":"Type 2 Diabetes","terminationReasons":[],"avgRecruitmentDays":120,"participantTarget":120,"recruitmentByImpact":[],"timelineBuckets":[],"generatedAt":"2026-04-17T00:00:00.000Z"}\n```',
          },
        ],
      }),
    });

    const result = await generateAIResults(request, trials);

    expect(result.overallScore).toBe(88);
    expect(result.totalTrialsFound).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        }),
      })
    );
  });

  it("throws a descriptive error for non-ok Anthropic responses", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("backend exploded"),
    });

    await expect(generateAIResults(request, trials)).rejects.toThrow(
      "Anthropic API error 500: backend exploded"
    );
  });

  it("throws a parse error when the model returns invalid JSON", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "not valid json" }],
      }),
    });

    await expect(generateAIResults(request, trials)).rejects.toThrow(
      "Failed to parse AI response as JSON:"
    );
  });
});
