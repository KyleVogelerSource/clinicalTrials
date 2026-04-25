import { describe, it, expect } from "vitest";
import { generateSynopsis, generateSynopses } from "./TrialSynopsisGenerator";
import { makeTrial } from "./TestHelpers";

describe("TrialSynopsisGenerator — BE-7", () => {
    it("returns the correct nctId", () => {
        const result = generateSynopsis(makeTrial({ nctId: "NCT12345678" }));
        expect(result.nctId).toBe("NCT12345678");
    });

    it("includes brief title", () => {
        const result = generateSynopsis(makeTrial({ briefTitle: "My Study" }));
        expect(result.synopsis).toContain("Title: My Study");
    });

    it("includes conditions joined by comma", () => {
        const result = generateSynopsis(makeTrial({ conditions: ["Cancer", "Anemia"] }));
        expect(result.synopsis).toContain("Condition(s): Cancer, Anemia");
    });

    it("includes interventions", () => {
        const result = generateSynopsis(makeTrial({ interventions: ["Drug A", "Placebo"] }));
        expect(result.synopsis).toContain("Intervention(s): Drug A, Placebo");
    });

    it("includes phase and study type", () => {
        const result = generateSynopsis(makeTrial({ phase: "PHASE3", studyType: "INTERVENTIONAL" }));
        expect(result.synopsis).toContain("Phase: PHASE3");
        expect(result.synopsis).toContain("Study Type: INTERVENTIONAL");
    });

    it("omits phase line when phase is NA", () => {
        const result = generateSynopsis(makeTrial({ phase: "NA", studyType: "UNKNOWN" }));
        expect(result.synopsis).not.toContain("Phase:");
        expect(result.synopsis).not.toContain("Study Type:");
    });

    it("includes up to 3 primary outcomes", () => {
        const result = generateSynopsis(
            makeTrial({ primaryOutcomes: ["Outcome A", "Outcome B", "Outcome C", "Outcome D"] })
        );
        expect(result.synopsis).toContain("Outcome A");
        expect(result.synopsis).toContain("Outcome B");
        expect(result.synopsis).toContain("Outcome C");
        expect(result.synopsis).not.toContain("Outcome D");
    });

    it("truncates eligibility criteria at 2000 chars and appends ellipsis", () => {
        const longText = "x".repeat(2500);
        const result = generateSynopsis(makeTrial({ eligibilityCriteria: longText }));
        expect(result.synopsis).toContain("...");
        const eligibilityLine = result.synopsis.split("\n").find((l) => l.startsWith("Eligibility:"))!;
        expect(eligibilityLine.length).toBe(13 + 2000 + 3);
    });

    it("does not append ellipsis when eligibility is within limit", () => {
        const shortText = "Short criteria.";
        const result = generateSynopsis(makeTrial({ eligibilityCriteria: shortText }));
        expect(result.synopsis).not.toContain("...");
    });

    it("is deterministic — same input produces same output", () => {
        const trial = makeTrial();
        const r1 = generateSynopsis(trial);
        const r2 = generateSynopsis(trial);
        expect(r1.synopsis).toBe(r2.synopsis);
    });

    it("omits empty sections gracefully", () => {
        const result = generateSynopsis(
            makeTrial({
                conditions: [],
                interventions: [],
                primaryOutcomes: [],
                eligibilityCriteria: "",
            })
        );
        expect(result.synopsis).not.toContain("Condition(s):");
        expect(result.synopsis).not.toContain("Intervention(s):");
        expect(result.synopsis).not.toContain("Primary Outcome(s):");
        expect(result.synopsis).not.toContain("Eligibility:");
    });

    it("generateSynopses maps over an array correctly", () => {
        const trials = [makeTrial({ nctId: "NCT00000001" }), makeTrial({ nctId: "NCT00000002" })];
        const results = generateSynopses(trials);
        expect(results).toHaveLength(2);
        expect(results[0].nctId).toBe("NCT00000001");
        expect(results[1].nctId).toBe("NCT00000002");
    });
});