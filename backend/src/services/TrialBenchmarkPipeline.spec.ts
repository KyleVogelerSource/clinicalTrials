import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrialResultsRequest } from "../dto/TrialResultsRequest";
import { makeTrial } from "./TestHelpers";

const mocks = vi.hoisted(() => ({
  generateEmbeddings: vi.fn(),
  generateExplanation: vi.fn(),
}));

vi.mock("./TrialEmbeddingService", () => ({
  generateEmbeddings: mocks.generateEmbeddings,
}));

vi.mock("./TrialExplanationService", () => ({
  generateExplanation: mocks.generateExplanation,
}));

describe("TrialBenchmarkPipeline", () => {
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
    inclusionCriteria: [{ description: "Adults with diabetes", conceptId: "C001" }],
    exclusionCriteria: [{ description: "pregnancy" }],
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("returns an empty benchmark result without generating embeddings when there are no candidates", async () => {
    const { runBenchmarkPipeline } = await import("./TrialBenchmarkPipeline");

    const result = await runBenchmarkPipeline(request, [], null, 5, "anthropic-key", "voyage-key");

    expect(result.rankedTrials).toEqual([]);
    expect(result.totalCandidates).toBe(0);
    expect(result.topK).toBe(5);
    expect(result.explanation.explanation).toContain("No similar historical trials were found");
    expect(result.eligibilityComparison).toEqual({ inclusion: [], exclusion: [] });
    expect(result.comparisonMetrics).toEqual([]);
    expect(result.pipelineSteps).toEqual({
      synopsesGenerated: 0,
      embeddingsGenerated: 0,
      embeddingCacheHits: 0,
      totalInputTokens: 0,
    });
    expect(mocks.generateEmbeddings).not.toHaveBeenCalled();
    expect(mocks.generateExplanation).not.toHaveBeenCalled();
  });

  it("generates proposed and candidate embeddings, ranks candidates, and builds downstream outputs", async () => {
    const { runBenchmarkPipeline } = await import("./TrialBenchmarkPipeline");
    const candidates = [
      makeTrial({
        nctId: "NCTPIPE001",
        briefTitle: "Closest diabetes trial",
        enrollmentCount: 100,
        eligibilityCriteria: "Adults with diabetes are eligible. Pregnancy is excluded.",
      }),
      makeTrial({
        nctId: "NCTPIPE002",
        briefTitle: "Less similar trial",
        enrollmentCount: 50,
        eligibilityCriteria: "Adults with hypertension are eligible.",
      }),
    ];

    mocks.generateEmbeddings.mockResolvedValueOnce({
      totalInputTokens: 42,
      embeddings: [
        { nctId: "__proposed__", embedding: [1, 0] },
        { nctId: "NCTPIPE001", embedding: [1, 0] },
        { nctId: "NCTPIPE002", embedding: [0, 1] },
      ],
    });
    mocks.generateExplanation.mockResolvedValueOnce({
      explanation: "Generated explanation.",
      generatedAt: "2026-04-10T00:00:00.000Z",
    });

    const result = await runBenchmarkPipeline(request, candidates, null, 1, "anthropic-key", "voyage-key");

    expect(result.rankedTrials).toHaveLength(1);
    expect(result.rankedTrials[0]).toMatchObject({
      rank: 1,
      similarityScore: 1,
      trial: expect.objectContaining({ nctId: "NCTPIPE001" }),
    });
    expect(result.proposedNctId).toBeNull();
    expect(result.totalCandidates).toBe(2);
    expect(result.pipelineSteps).toEqual({
      synopsesGenerated: 2,
      embeddingsGenerated: 3,
      embeddingCacheHits: 0,
      totalInputTokens: 42,
    });
    expect(result.explanation.explanation).toBe("Generated explanation.");
    expect(result.eligibilityComparison.inclusion[0].matchingTrialIds).toEqual(["NCTPIPE001"]);
    expect(result.eligibilityComparison.exclusion[0].matchingTrialIds).toEqual(["NCTPIPE001"]);
    expect(result.comparisonMetrics.some((entry) => entry.nctId === "NCTPIPE001")).toBe(true);
    expect(mocks.generateExplanation).toHaveBeenCalledWith(
      request,
      result.rankedTrials,
      expect.objectContaining({ poolSize: 1 }),
      "anthropic-key"
    );
  });

  it("uses cached candidate embeddings on subsequent runs and embeds only the proposed trial", async () => {
    const { runBenchmarkPipeline } = await import("./TrialBenchmarkPipeline");
    const candidates = [
      makeTrial({ nctId: "NCTCACHE001", briefTitle: "Cached trial one" }),
      makeTrial({ nctId: "NCTCACHE002", briefTitle: "Cached trial two" }),
    ];

    mocks.generateEmbeddings
      .mockResolvedValueOnce({
        totalInputTokens: 30,
        embeddings: [
          { nctId: "__proposed__", embedding: [1, 0] },
          { nctId: "NCTCACHE001", embedding: [1, 0] },
          { nctId: "NCTCACHE002", embedding: [0, 1] },
        ],
      })
      .mockResolvedValueOnce({
        totalInputTokens: 10,
        embeddings: [{ nctId: "__proposed__", embedding: [0, 1] }],
      });
    mocks.generateExplanation.mockResolvedValue({
      explanation: "Generated explanation.",
      generatedAt: "2026-04-10T00:00:00.000Z",
    });

    await runBenchmarkPipeline(request, candidates, null, 2, "anthropic-key", "voyage-key");
    const second = await runBenchmarkPipeline(request, candidates, null, 2, "anthropic-key", "voyage-key");

    expect(mocks.generateEmbeddings).toHaveBeenCalledTimes(2);
    expect(mocks.generateEmbeddings.mock.calls[1][0]).toEqual([
      expect.objectContaining({ nctId: "__proposed__" }),
    ]);
    expect(second.pipelineSteps).toMatchObject({
      synopsesGenerated: 2,
      embeddingsGenerated: 1,
      embeddingCacheHits: 2,
      totalInputTokens: 10,
    });
    expect(second.rankedTrials[0].trial.nctId).toBe("NCTCACHE002");
  });

  it("uses a provided trial synopsis and nct id for the proposed design", async () => {
    const { runBenchmarkPipeline } = await import("./TrialBenchmarkPipeline");
    const proposed = makeTrial({ nctId: "NCTPROPOSED", briefTitle: "Proposed existing trial" });
    const candidates = [makeTrial({ nctId: "NCTPROVIDED001" })];

    mocks.generateEmbeddings.mockResolvedValueOnce({
      totalInputTokens: 12,
      embeddings: [
        { nctId: "NCTPROPOSED", embedding: [1, 0] },
        { nctId: "NCTPROVIDED001", embedding: [1, 0] },
      ],
    });
    mocks.generateExplanation.mockResolvedValueOnce({
      explanation: "Generated explanation.",
      generatedAt: "2026-04-10T00:00:00.000Z",
    });

    const result = await runBenchmarkPipeline(request, candidates, proposed, 1, "anthropic-key", "voyage-key");

    expect(result.proposedNctId).toBe("NCTPROPOSED");
    expect(mocks.generateEmbeddings.mock.calls[0][0][0]).toMatchObject({ nctId: "NCTPROPOSED" });
  });

  it("throws when embedding generation omits the proposed embedding", async () => {
    const { runBenchmarkPipeline } = await import("./TrialBenchmarkPipeline");

    mocks.generateEmbeddings.mockResolvedValueOnce({
      totalInputTokens: 1,
      embeddings: [{ nctId: "NCTMISSING001", embedding: [1, 0] }],
    });

    await expect(
      runBenchmarkPipeline(
        request,
        [makeTrial({ nctId: "NCTMISSING001" })],
        null,
        1,
        "anthropic-key",
        "voyage-key"
      )
    ).rejects.toThrow("Failed to generate embedding for proposed trial");
  });
});
