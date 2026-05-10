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

  it("uses custom weights and scores mismatched trial attributes", async () => {
    const nct1 = buildStudy("NCT1");
    nct1.protocolSection.conditionsModule = { conditions: ["Diabetes", "Obesity"] };
    nct1.protocolSection.designModule = {
      phases: ["PHASE3"],
      studyType: "INTERVENTIONAL",
      enrollmentInfo: { count: 200, type: "Actual" },
    };
    nct1.protocolSection.eligibilityModule = {
      eligibilityCriteria: "Adults",
      sex: "MALE",
      minimumAge: "18 Years",
      maximumAge: "40 Years",
    };
    nct1.protocolSection.armsInterventionsModule = { interventions: [{ name: "Drug A" }, { name: "Diet" }] };
    nct1.protocolSection.statusModule = {
      overallStatus: "Completed",
      startDateStruct: { date: "2020-01" },
      completionDateStruct: { date: "2021-01" },
    };

    const nct2 = buildStudy("NCT2");
    nct2.protocolSection.conditionsModule = { conditions: ["Asthma"] };
    nct2.protocolSection.designModule = {
      phases: ["PHASE1"],
      studyType: "OBSERVATIONAL",
      enrollmentInfo: { count: 50, type: "Actual" },
    };
    nct2.protocolSection.eligibilityModule = {
      eligibilityCriteria: "Older adults",
      sex: "FEMALE",
      minimumAge: "65 Years",
      maximumAge: "90 Years",
    };
    nct2.protocolSection.armsInterventionsModule = { interventions: [{ name: "Device B" }] };
    nct2.protocolSection.statusModule = {
      overallStatus: "Completed",
      startDateStruct: { date: "2010-01" },
      completionDateStruct: { date: "2011-01" },
    };

    const studies: Record<string, ClinicalTrialStudy> = { NCT1: nct1, NCT2: nct2 };
    const searchFn = vi.fn(async (request) => ({
      totalCount: 1,
      studies: [studies[request.term as string]],
    } satisfies ClinicalTrialStudiesResponse));

    const result = await compareTrials({
      trials: [{ nctId: " NCT1 " }, { nctId: "NCT2" }],
      weights: {
        conditionOverlap: 10,
        eligibilityCompatibility: 30,
        statusRecency: 20,
      },
    }, searchFn);

    const cell = result.comparisonMatrix[0].scores.find((score) => score.againstNctId === "NCT2");
    expect(searchFn).toHaveBeenCalledWith({ term: "NCT1" });
    expect(cell?.weightedBreakdown.conditionOverlap).toBe(0);
    expect(cell?.weightedBreakdown.phaseMatch).toBe(0);
    expect(cell?.weightedBreakdown.studyType).toBe(0);
    expect(cell?.weightedBreakdown.eligibilityCompatibility).toBe(0);
    expect(cell?.weightedBreakdown.interventionOverlap).toBe(0);
    expect(cell?.weightedBreakdown.enrollmentSimilarity).toBeGreaterThan(0);
    expect(cell?.weightedBreakdown.statusRecency).toBe(0);
    expect(cell?.explanations).toEqual(expect.arrayContaining([
      "Conditions do not overlap.",
      expect.stringContaining("Phases differ"),
      expect.stringContaining("Study types differ"),
    ]));
  });

  it("handles empty overlaps, zero enrollments, and missing comparable dates", async () => {
    const first = buildStudy("NCTEMPTY1");
    first.protocolSection.conditionsModule = { conditions: [] };
    first.protocolSection.designModule = { phases: ["PHASE2"], studyType: "INTERVENTIONAL", enrollmentInfo: { count: 0 } };
    first.protocolSection.eligibilityModule = { eligibilityCriteria: "Adults", sex: "ALL" };
    first.protocolSection.armsInterventionsModule = { interventions: [] };
    first.protocolSection.statusModule = { overallStatus: "Completed" };

    const second = buildStudy("NCTEMPTY2");
    second.protocolSection.conditionsModule = { conditions: [] };
    second.protocolSection.designModule = { phases: ["PHASE2"], studyType: "INTERVENTIONAL", enrollmentInfo: { count: 0 } };
    second.protocolSection.eligibilityModule = { eligibilityCriteria: "Adults", sex: "ALL" };
    second.protocolSection.armsInterventionsModule = { interventions: [] };
    second.protocolSection.statusModule = { overallStatus: "Completed" };

    const studies: Record<string, ClinicalTrialStudy> = { NCTEMPTY1: first, NCTEMPTY2: second };
    const searchFn = vi.fn(async (request) => ({
      totalCount: 1,
      studies: [studies[request.term as string]],
    } satisfies ClinicalTrialStudiesResponse));

    const result = await compareTrials({
      trials: [{ nctId: "NCTEMPTY1" }, { nctId: "NCTEMPTY2" }],
    }, searchFn);

    const cell = result.comparisonMatrix[0].scores.find((score) => score.againstNctId === "NCTEMPTY2");
    expect(cell?.weightedBreakdown.conditionOverlap).toBe(25);
    expect(cell?.weightedBreakdown.interventionOverlap).toBe(10);
    expect(cell?.weightedBreakdown.enrollmentSimilarity).toBe(10);
    expect(cell?.weightedBreakdown.statusRecency).toBe(2.5);
  });
});
