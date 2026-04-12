import { describe, expect, it, vi } from "vitest";
import { compareTrials } from "./TrialCompareService";
import { ClinicalTrialStudiesResponse, ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";

function buildStudy(nctId: string, overrides: Partial<ClinicalTrialStudy> = {}): ClinicalTrialStudy {
  return {
    protocolSection: {
      identificationModule: {
        nctId,
        briefTitle: `${nctId} Title`,
      },
      statusModule: {
        overallStatus: "Recruiting",
        startDateStruct: { date: "2024-01" },
        completionDateStruct: { date: "2026-01" },
      },
      conditionsModule: {
        conditions: ["Diabetes"],
      },
      designModule: {
        phases: ["Phase 3"],
        studyType: "Interventional",
        enrollmentInfo: { count: 100, type: "Actual" },
      },
      eligibilityModule: {
        eligibilityCriteria: "Adults 18 to 65",
        sex: "All",
        minimumAge: "18 Years",
        maximumAge: "65 Years",
      },
      armsInterventionsModule: {
        interventions: [{ name: "Drug A" }],
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: "HbA1c" }],
      },
      sponsorCollaboratorsModule: {
        leadSponsor: { name: "Sponsor A" },
      },
      ...overrides.protocolSection,
    },
    ...overrides,
  } as ClinicalTrialStudy;
}

describe("TrialCompareService", () => {
  it("produces deterministic benchmark scores for comparable trials", async () => {
    const searchFn = vi.fn(async (request) => {
      const nctId = request.term as string;
      const study = nctId === "NCT2"
        ? buildStudy("NCT2")
        : buildStudy("NCT1");

      return {
        totalCount: 1,
        studies: [study],
      } satisfies ClinicalTrialStudiesResponse;
    });

    const result = await compareTrials({
      trials: [{ nctId: "NCT1" }, { nctId: "NCT2" }],
    }, searchFn);

    expect(result.normalizedTrials).toHaveLength(2);
    expect(result.comparisonMatrix).toHaveLength(2);
    expect(result.benchmarkScores[0].score).toBeGreaterThan(0);
    expect(result.comparisonMatrix[0].scores[1].explanations.length).toBeGreaterThan(0);
  });

  it("throws when a requested trial cannot be resolved", async () => {
    const searchFn = vi.fn(async () => ({
      totalCount: 0,
      studies: [],
    } satisfies ClinicalTrialStudiesResponse));

    await expect(compareTrials({ trials: [{ nctId: "NCT404" }, { nctId: "NCT405" }] }, searchFn))
      .rejects.toThrow("TRIAL_NOT_FOUND:NCT404");
  });
});
