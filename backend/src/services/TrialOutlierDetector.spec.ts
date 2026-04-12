import { describe, it, expect } from "vitest";
import { detectOutliers } from "./TrialOutlierDetector";
import { NormalizedTrial } from "../models/NormalizedTrial";

function makeTrial(overrides: Partial<NormalizedTrial> = {}): NormalizedTrial {
    return {
        nctId: "NCT00000001",
        briefTitle: "Test Trial",
        phase: "PHASE2",
        studyType: "INTERVENTIONAL",
        overallStatus: "COMPLETED",
        enrollmentCount: 100,
        enrollmentType: "ACTUAL",
        startDate: "2020-01",
        completionDate: "2022-01",
        conditions: ["Diabetes"],
        interventions: ["Drug X"],
        eligibilityCriteria: "Adults 18-65.",
        sex: "ALL",
        minimumAge: "18 Years",
        maximumAge: "65 Years",
        primaryOutcomes: [],
        sponsor: null,
        ...overrides,
    };
}

describe("detectOutliers — BE-10", () => {
    describe("enrollment count benchmarks", () => {
        it("flags HIGH when proposed enrollment is in top percentile", () => {
            const pool = [50, 100, 150, 200, 250].map((n, i) =>
                makeTrial({ nctId: `NCT0000000${i}`, enrollmentCount: n })
            );

            const result = detectOutliers(pool, { enrollmentCount: 900 });
            const eb = result.numeric.find((b) => b.attribute === "enrollmentCount")!;

            expect(eb.outlier).toBe("HIGH");
            expect(eb.proposedValue).toBe(900);
        });

        it("flags LOW when proposed enrollment is in bottom percentile", () => {
            const pool = [100, 200, 300, 400, 500].map((n, i) =>
                makeTrial({ nctId: `NCT0000000${i}`, enrollmentCount: n })
            );

            const result = detectOutliers(pool, { enrollmentCount: 5 });
            const eb = result.numeric.find((b) => b.attribute === "enrollmentCount")!;

            expect(eb.outlier).toBe("LOW");
        });

        it("returns NORMAL when proposed enrollment is in the middle", () => {
            const pool = [50, 100, 150, 200, 250].map((n, i) =>
                makeTrial({ nctId: `NCT0000000${i}`, enrollmentCount: n })
            );

            const result = detectOutliers(pool, { enrollmentCount: 150 });
            const eb = result.numeric.find((b) => b.attribute === "enrollmentCount")!;

            expect(eb.outlier).toBe("NORMAL");
        });

        it("returns null percentile when proposed value is null", () => {
            const pool = [makeTrial({ enrollmentCount: 100 })];
            const result = detectOutliers(pool, { enrollmentCount: null });
            const eb = result.numeric.find((b) => b.attribute === "enrollmentCount")!;

            expect(eb.proposedPercentile).toBeNull();
            expect(eb.outlier).toBe("NORMAL");
        });

        it("computes correct pool statistics", () => {
            const pool = [100, 200, 300, 400, 500].map((n, i) =>
                makeTrial({ nctId: `NCT0000000${i}`, enrollmentCount: n })
            );

            const result = detectOutliers(pool, { enrollmentCount: 300 });
            const eb = result.numeric.find((b) => b.attribute === "enrollmentCount")!;

            expect(eb.poolMin).toBe(100);
            expect(eb.poolMax).toBe(500);
            expect(eb.poolMedian).toBe(300);
            expect(eb.poolMean).toBe(300);
        });
    });

    describe("duration benchmarks", () => {
        it("computes duration from start and completion dates", () => {
            const pool = [
                makeTrial({ nctId: "NCT001", startDate: "2020-01", completionDate: "2021-01" }),
                makeTrial({ nctId: "NCT002", startDate: "2020-01", completionDate: "2022-01" }),
            ];

            const result = detectOutliers(pool, {
                startDate: "2020-01",
                completionDate: "2021-07",
            });

            const db = result.numeric.find((b) => b.attribute === "durationDays")!;
            expect(db.proposedValue).toBeGreaterThan(0);
            expect(db.poolMin).toBeGreaterThan(0);
        });

        it("returns null duration when dates are missing", () => {
            const pool = [makeTrial({ startDate: "2020-01", completionDate: "2022-01" })];
            const result = detectOutliers(pool, { startDate: null, completionDate: null });
            const db = result.numeric.find((b) => b.attribute === "durationDays")!;

            expect(db.proposedValue).toBeNull();
        });
    });

    describe("categorical benchmarks", () => {
        it("marks phase as uncommon when it appears in fewer than 20% of pool trials", () => {
            const pool = [
                ...Array(8).fill(null).map((_, i) => makeTrial({ nctId: `NCT00${i}`, phase: "PHASE3" })),
                makeTrial({ nctId: "NCT009", phase: "PHASE1" }),
            ];

            const result = detectOutliers(pool, { phase: "PHASE1" });
            const pb = result.categorical.find((b) => b.attribute === "phase")!;

            expect(pb.uncommon).toBe(true);
            expect(pb.proposedFrequencyPct).toBeLessThan(20);
        });

        it("marks phase as common when it appears in majority of pool trials", () => {
            const pool = Array(5).fill(null).map((_, i) =>
                makeTrial({ nctId: `NCT00${i}`, phase: "PHASE2" })
            );

            const result = detectOutliers(pool, { phase: "PHASE2" });
            const pb = result.categorical.find((b) => b.attribute === "phase")!;

            expect(pb.uncommon).toBe(false);
            expect(pb.proposedFrequencyPct).toBe(100);
        });

        it("includes frequency counts for all pool values", () => {
            const pool = [
                makeTrial({ nctId: "NCT001", phase: "PHASE2" }),
                makeTrial({ nctId: "NCT002", phase: "PHASE2" }),
                makeTrial({ nctId: "NCT003", phase: "PHASE3" }),
            ];

            const result = detectOutliers(pool, { phase: "PHASE2" });
            const pb = result.categorical.find((b) => b.attribute === "phase")!;

            expect(pb.poolFrequency["PHASE2"]).toBe(2);
            expect(pb.poolFrequency["PHASE3"]).toBe(1);
        });
    });

    describe("edge cases", () => {
        it("handles empty pool gracefully", () => {
            const result = detectOutliers([], { enrollmentCount: 100 });

            expect(result.poolSize).toBe(0);
            expect(result.numeric.every((b) => b.proposedPercentile === null)).toBe(true);
        });

        it("returns correct poolSize", () => {
            const pool = Array(7).fill(null).map((_, i) => makeTrial({ nctId: `NCT00${i}` }));
            const result = detectOutliers(pool, {});

            expect(result.poolSize).toBe(7);
        });

        it("respects custom thresholds", () => {
            const pool = [100, 200, 300, 400, 500].map((n, i) =>
                makeTrial({ nctId: `NCT0000000${i}`, enrollmentCount: n })
            );

            const result = detectOutliers(
                pool,
                { enrollmentCount: 500 },
                { lowerPercentile: 40, upperPercentile: 60 }
            );

            const eb = result.numeric.find((b) => b.attribute === "enrollmentCount")!;
            expect(eb.outlier).toBe("HIGH");
            expect(result.thresholds.upperPercentile).toBe(60);
        });
    });
});