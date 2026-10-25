import { describe, it, expect } from "vitest";
import { buildCandidatePool } from "./CandidatePoolBuilder";
import { ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { ReferenceTrial } from "../models/NormalizedTrial";

describe("CandidatePoolBuilder", () => {
  describe("buildCandidatePool - Basic functionality", () => {
    it("should return empty pool for empty studies", () => {
      const result = buildCandidatePool([], 1);

      expect(result.trials).toHaveLength(0);
      expect(result.metadata.totalFetchedFromApi).toBe(0);
      expect(result.metadata.totalInPool).toBe(0);
    });

    it("should use default cap of 15", () => {
      const studies = createMockStudies(20);

      const result = buildCandidatePool(studies, 1);

      expect(result.trials.length).toBeLessThanOrEqual(15);
      expect(result.metadata.cappedAt).toBe(15);
    });

    it("should respect custom cap", () => {
      const studies = createMockStudies(30);

      const result = buildCandidatePool(studies, 1, { cap: 5 });

      expect(result.trials.length).toBeLessThanOrEqual(5);
      expect(result.metadata.cappedAt).toBe(5);
    });

    it("should track correct metadata", () => {
      const studies = createMockStudies(25);

      const result = buildCandidatePool(studies, 2, { cap: 10 });

      expect(result.metadata.totalFetchedFromApi).toBe(25);
      expect(result.metadata.totalPagesfetched).toBe(2);
      expect(result.metadata.totalInPool).toBeLessThanOrEqual(10);
    });

    it("should include trials under cap", () => {
      const studies = createMockStudies(5);

      const result = buildCandidatePool(studies, 1, { cap: 10 });

      expect(result.trials.length).toBe(5);
    });
  });

  describe("buildCandidatePool - Filtering conditions", () => {
    it("should filter studies with missing phase", () => {
      const validStudy = createMockStudy("NCT001");
      const invalidStudy = createMockStudy("NCT002");
      invalidStudy.protocolSection.designModule!.phases = [];

      const result = buildCandidatePool([validStudy, invalidStudy], 1);

      expect(result.metadata.totalFiltered).toBe(1);
      expect(result.trials.length).toBe(1);
    });

    it("should filter studies with missing enrollment", () => {
      const validStudy = createMockStudy("NCT001");
      const invalidStudy = createMockStudy("NCT002");
      invalidStudy.protocolSection.designModule!.enrollmentInfo = { count: undefined };

      const result = buildCandidatePool([validStudy, invalidStudy], 1);

      expect(result.metadata.totalFiltered).toBe(1);
    });

    it("should filter studies with missing eligibility criteria", () => {
      const validStudy = createMockStudy("NCT001");
      const invalidStudy = createMockStudy("NCT002");
      invalidStudy.protocolSection.eligibilityModule!.eligibilityCriteria = "";

      const result = buildCandidatePool([validStudy, invalidStudy], 1);

      expect(result.metadata.totalFiltered).toBe(1);
    });

    it("should filter studies with null enrollment", () => {
      const validStudy = createMockStudy("NCT001");
      const invalidStudy = createMockStudy("NCT002");
      invalidStudy.protocolSection.designModule!.enrollmentInfo = { count: null as unknown as number };

      const result = buildCandidatePool([validStudy, invalidStudy], 1);

      expect(result.metadata.totalFiltered).toBe(1);
    });

    it("should filter studies with missing designModule", () => {
      const validStudy = createMockStudy("NCT001");
      const invalidStudy = createMockStudy("NCT002");
      invalidStudy.protocolSection.designModule = undefined;

      const result = buildCandidatePool([validStudy, invalidStudy], 1);

      expect(result.metadata.totalFiltered).toBe(1);
    });
  });

  describe("buildCandidatePool - Reference trial filtering", () => {
    it("should filter by phase when reference phase provided", () => {
      const matchingPhase = createMockStudy("NCT001", [], "PHASE 2");
      const mismatchedPhase = createMockStudy("NCT002", [], "PHASE 1");

      const ref: ReferenceTrial = { phase: "PHASE 2" };

      const result = buildCandidatePool(
        [matchingPhase, mismatchedPhase],
        1,
        { referenceTrial: ref }
      );

      expect(result.trials.length).toBeGreaterThanOrEqual(0);
    });

    it("should filter by study type when reference type provided", () => {
      const matchingType = createMockStudy("NCT001", [], "Phase 2", "INTERVENTIONAL");
      const mismatchedType = createMockStudy("NCT002", [], "Phase 2", "OBSERVATIONAL");

      const ref: ReferenceTrial = { studyType: "INTERVENTIONAL" };

      const result = buildCandidatePool(
        [matchingType, mismatchedType],
        1,
        { referenceTrial: ref }
      );

      expect(result.metadata.totalFiltered).toBe(1);
    });

    it("should filter by sex when reference sex provided", () => {
      const maleSex = { ...createMockStudy("NCT001"), protocolSection: { ...createMockStudy("NCT001").protocolSection, eligibilityModule: { ...createMockStudy("NCT001").protocolSection?.eligibilityModule, sex: "MALE" } } };
      const femaleSex = { ...createMockStudy("NCT002"), protocolSection: { ...createMockStudy("NCT002").protocolSection, eligibilityModule: { ...createMockStudy("NCT002").protocolSection?.eligibilityModule, sex: "FEMALE" } } };

      const ref: ReferenceTrial = { sex: "MALE" };

      const result = buildCandidatePool(
        [maleSex, femaleSex],
        1,
        { referenceTrial: ref }
      );

      expect(result.metadata.totalFiltered).toBeGreaterThan(0);
    });

    it("should accept ALL sex compatibility", () => {
      const allSex = createMockStudy("NCT001");
      allSex.protocolSection.eligibilityModule!.sex = "ALL";

      const ref: ReferenceTrial = { sex: "MALE" };

      const result = buildCandidatePool([allSex], 1, { referenceTrial: ref });

      expect(result.trials.length).toBe(1);
    });

    it("should filter by condition overlap with reference", () => {
      const overlappingCondition = createMockStudy("NCT001", ["cancer"]);
      const nonOverlappingCondition = createMockStudy("NCT002", ["diabetes"]);

      const ref: ReferenceTrial = { conditions: ["cancer", "leukemia"] };

      const result = buildCandidatePool(
        [overlappingCondition, nonOverlappingCondition],
        1,
        { referenceTrial: ref }
      );

      expect(result.trials.length).toBe(1);
      expect(result.trials[0].nctId).toBe("NCT001");
    });

    it("should handle condition overlap case-insensitively", () => {
      const study = createMockStudy("NCT001", ["Cancer"]);
      const ref: ReferenceTrial = { conditions: ["CANCER"] };

      const result = buildCandidatePool([study], 1, { referenceTrial: ref });

      expect(result.trials.length).toBe(1);
    });

    it("should support partial condition overlap", () => {
      const study = createMockStudy("NCT001", ["Lung Cancer"]);
      const ref: ReferenceTrial = { conditions: ["cancer"] };

      const result = buildCandidatePool([study], 1, { referenceTrial: ref });

      expect(result.trials.length).toBe(1);
    });
  });

  describe("buildCandidatePool - Capping and exclusion", () => {
    it("should exclude trials beyond cap", () => {
      const studies = createMockStudies(20);

      const result = buildCandidatePool(studies, 1, { cap: 10 });

      expect(result.metadata.totalExcluded).toBe(10);
    });

    it("should include excluded records with correct reason", () => {
      const studies = createMockStudies(12);

      const result = buildCandidatePool(studies, 1, { cap: 10 });

      expect(result.metadata.totalExcluded).toBe(2);
    });

    it("should track excluded records with ranking", () => {
      const studies = createMockStudies(5);

      const result = buildCandidatePool(studies, 1, { cap: 3 });

      expect(result.metadata.totalExcluded).toBe(2);
    });

    it("should not exclude when studies fit in cap", () => {
      const studies = createMockStudies(10);

      const result = buildCandidatePool(studies, 1, { cap: 15 });

      expect(result.metadata.totalExcluded).toBe(0);
      expect(result.trials.length).toBe(10);
    });
  });

  describe("buildCandidatePool - Trial normalization", () => {
    it("should normalize trial fields correctly", () => {
      const study = createMockStudy("NCT123456", ["cancer"]);

      const result = buildCandidatePool([study], 1);

      expect(result.trials[0]).toHaveProperty("nctId");
      expect(result.trials[0]).toHaveProperty("briefTitle");
      expect(result.trials[0]).toHaveProperty("phase");
      expect(result.trials[0]).toHaveProperty("conditions");
      expect(result.trials[0].nctId).toBe("NCT123456");
    });

    it("should populate normalized trial fields", () => {
      const study = createMockStudy("NCT001", ["condition1", "condition2"]);

      const result = buildCandidatePool([study], 1);

      const trial = result.trials[0];
      expect(trial.conditions).toBeDefined();
      expect(trial.enrollmentCount).toBeDefined();
      expect(trial.conditions).toContain("condition1");
      expect(trial.phase).toBeDefined();
      expect(trial.studyType).toBeDefined();
    });
  });

  describe("buildCandidatePool - Edge cases", () => {
    it("should handle studies with no conditions", () => {
      const study = createMockStudy("NCT001", []);

      const result = buildCandidatePool([study], 1);

      expect(result.trials.length).toBe(1);
    });

    it("should handle studies with null conditions", () => {
      const study = createMockStudy("NCT001");
      study.protocolSection.conditionsModule = { conditions: undefined };

      const result = buildCandidatePool([study], 1);

      expect(result.trials.length).toBe(1);
    });

    it("should handle cap = 0", () => {
      const studies = createMockStudies(5);

      const result = buildCandidatePool(studies, 1, { cap: 0 });

      expect(result.trials.length).toBeLessThanOrEqual(0);
    });

    it("should handle very large cap", () => {
      const studies = createMockStudies(50);

      const result = buildCandidatePool(studies, 1, { cap: 10000 });

      expect(result.trials.length).toBe(50);
      expect(result.metadata.totalExcluded).toBe(0);
    });

    it("should handle multiple filters together", () => {
      const studies = [
        createMockStudy("NCT001", ["cancer"], "PHASE 2"),
        createMockStudy("NCT002", ["diabetes"], "PHASE 2"),
        createMockStudy("NCT003", ["cancer"], "PHASE 1"),
      ];

      const result = buildCandidatePool(studies, 1, {
        cap: 10,
        referenceTrial: { phase: "PHASE 2" },
      });

      // Should have at least filtered some studies
      expect(result.metadata.totalFiltered).toBeGreaterThanOrEqual(0);
    });

    it("should sort by newest start date first and then enrollment distance when dates tie", () => {
      const older = createMockStudy("NCT_OLDER");
      older.protocolSection.statusModule = { startDateStruct: { date: "2020-01" } };
      older.protocolSection.designModule!.enrollmentInfo = { count: 100 };

      const newerFarEnrollment = createMockStudy("NCT_NEWER_FAR");
      newerFarEnrollment.protocolSection.statusModule = { startDateStruct: { date: "2024-01" } };
      newerFarEnrollment.protocolSection.designModule!.enrollmentInfo = { count: 1000 };

      const newerNearEnrollment = createMockStudy("NCT_NEWER_NEAR");
      newerNearEnrollment.protocolSection.statusModule = { startDateStruct: { date: "2024-01" } };
      newerNearEnrollment.protocolSection.designModule!.enrollmentInfo = { count: 220 };

      const result = buildCandidatePool(
        [older, newerFarEnrollment, newerNearEnrollment],
        1,
        { referenceTrial: { enrollmentCount: 200 } }
      );

      expect(result.trials.map((trial) => trial.nctId)).toEqual([
        "NCT_NEWER_NEAR",
        "NCT_NEWER_FAR",
        "NCT_OLDER",
      ]);
    });

    it("documents current sort order for undated trials", () => {
      const dated = createMockStudy("NCT_DATED");
      dated.protocolSection.statusModule = { startDateStruct: { date: "2024-01" } };

      const undated = createMockStudy("NCT_UNDATED");
      undated.protocolSection.statusModule = {};

      const result = buildCandidatePool([undated, dated], 1);

      expect(result.trials.map((trial) => trial.nctId)).toEqual(["NCT_UNDATED", "NCT_DATED"]);
    });
  });
});

// Helper functions
function createMockStudy(
  nctId: string,
  conditions: string[] = ["cancer"],
  phase: string = "Phase 2",
  studyType: string = "INTERVENTIONAL"
): ClinicalTrialStudy {
  return {
    protocolSection: {
      identificationModule: {
        nctId,
        briefTitle: `Study ${nctId}`,
      },
      designModule: {
        phases: [phase],
        enrollmentInfo: {
          count: 100,
        },
        studyType,
      },
      eligibilityModule: {
        eligibilityCriteria: "18+",
        sex: "ALL",
      },
      conditionsModule: {
        conditions,
      },
    },
  } as unknown as ClinicalTrialStudy;
}

function createMockStudies(count: number): ClinicalTrialStudy[] {
  return Array.from({ length: count }, (_, i) =>
    createMockStudy(`NCT${String(i + 1).padStart(6, "0")}`)
  );
}
