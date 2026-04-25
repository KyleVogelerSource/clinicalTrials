import { describe, it, expect } from "vitest";
import { cosineSimilarity, rankBySimiliarity } from "./TrialSimilarityService";
import { makeTrial } from "./TestHelpers";

describe("cosineSimilarity — BE-9", () => {
    it("returns 1.0 for identical vectors", () => {
        const v = [1, 2, 3, 4];
        expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
    });

    it("returns 0.0 for orthogonal vectors", () => {
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
    });

    it("returns 0.0 for zero vectors", () => {
        expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    });

    it("returns 0.0 for empty vectors", () => {
        expect(cosineSimilarity([], [])).toBe(0);
    });

    it("returns 0.0 for mismatched lengths", () => {
        expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it("returns value in [-1, 1] range", () => {
        const a = [0.5, -0.3, 0.8, 0.1];
        const b = [-0.2, 0.6, 0.3, -0.9];
        const score = cosineSimilarity(a, b);
        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
    });

    it("is symmetric — similarity(a,b) === similarity(b,a)", () => {
        const a = [1, 2, 3];
        const b = [4, 5, 6];
        expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
    });
});

describe("rankBySimiliarity — BE-9", () => {
    it("returns trials sorted by descending similarity score", () => {
        const proposed = [1, 0, 0];
        const candidateEmbeddings = new Map([
            ["NCT001", [0.9, 0.1, 0]],
            ["NCT002", [0, 1, 0]],
            ["NCT003", [0.8, 0.2, 0]],
        ]);
        const trials = ["NCT001", "NCT002", "NCT003"].map((id) => makeTrial({ nctId: id }));

        const result = rankBySimiliarity(proposed, candidateEmbeddings, trials, 3);

        expect(result.rankedTrials[0].trial.nctId).toBe("NCT001");
        expect(result.rankedTrials[1].trial.nctId).toBe("NCT003");
        expect(result.rankedTrials[2].trial.nctId).toBe("NCT002");
    });

    it("assigns correct 1-based ranks", () => {
        const proposed = [1, 0];
        const candidateEmbeddings = new Map([
            ["NCT001", [1, 0]],
            ["NCT002", [0, 1]],
        ]);
        const trials = ["NCT001", "NCT002"].map((id) => makeTrial({ nctId: id }));

        const result = rankBySimiliarity(proposed, candidateEmbeddings, trials, 10);

        expect(result.rankedTrials[0].rank).toBe(1);
        expect(result.rankedTrials[1].rank).toBe(2);
    });

    it("respects topK cap", () => {
        const proposed = [1, 0];
        const candidateEmbeddings = new Map([
            ["NCT001", [1, 0]],
            ["NCT002", [0.9, 0.1]],
            ["NCT003", [0.8, 0.2]],
            ["NCT004", [0.7, 0.3]],
        ]);
        const trials = ["NCT001", "NCT002", "NCT003", "NCT004"].map((id) => makeTrial({ nctId: id }));

        const result = rankBySimiliarity(proposed, candidateEmbeddings, trials, 2);

        expect(result.rankedTrials).toHaveLength(2);
        expect(result.topK).toBe(2);
        expect(result.totalCandidates).toBe(4);
    });

    it("returns all candidates when topK exceeds pool size", () => {
        const proposed = [1, 0];
        const candidateEmbeddings = new Map([["NCT001", [1, 0]], ["NCT002", [0, 1]]]);
        const trials = ["NCT001", "NCT002"].map((id) => makeTrial({ nctId: id }));

        const result = rankBySimiliarity(proposed, candidateEmbeddings, trials, 100);

        expect(result.rankedTrials).toHaveLength(2);
    });

    it("returns empty list when no candidates provided", () => {
        const proposed = [1, 0];
        const result = rankBySimiliarity(proposed, new Map(), [], 15);
        expect(result.rankedTrials).toHaveLength(0);
        expect(result.totalCandidates).toBe(0);
    });

    it("rounds similarity scores to 4 decimal places", () => {
        const proposed = [1, 1, 1];
        const candidateEmbeddings = new Map([["NCT001", [1, 2, 3]]]);
        const trials = [makeTrial({ nctId: "NCT001" })];

        const result = rankBySimiliarity(proposed, candidateEmbeddings, trials, 1);
        const score = result.rankedTrials[0].similarityScore;

        const rounded = Math.round(score * 10000) / 10000;
        expect(score).toBe(rounded);
    });

    it("sets proposedNctId in result", () => {
        const result = rankBySimiliarity([1, 0], new Map(), [], 15, "NCT_PROPOSED");
        expect(result.proposedNctId).toBe("NCT_PROPOSED");
    });
});