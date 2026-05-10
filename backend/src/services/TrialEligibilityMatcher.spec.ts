import { describe, expect, it } from "vitest";
import { NormalizedTrial } from "../models/NormalizedTrial";
import { matchEligibilityCriteria } from "./TrialEligibilityMatcher";

function trial(nctId: string, eligibilityCriteria: string): NormalizedTrial {
  return {
    nctId,
    briefTitle: `${nctId} title`,
    officialTitle: null,
    acronym: null,
    phase: "PHASE2",
    studyType: "INTERVENTIONAL",
    overallStatus: "COMPLETED",
    whyStopped: null,
    hasResults: false,
    enrollmentCount: 10,
    enrollmentType: "ACTUAL",
    startDate: null,
    completionDate: null,
    allocation: null,
    interventionModel: null,
    primaryPurpose: null,
    masking: null,
    whoMasked: [],
    conditions: [],
    interventions: [],
    interventionTypes: [],
    armCount: 0,
    eligibilityCriteria,
    sex: "ALL",
    minimumAge: null,
    maximumAge: null,
    healthyVolunteers: null,
    stdAges: [],
    primaryOutcomes: [],
    secondaryOutcomes: [],
    sponsor: null,
    sponsorClass: null,
    collaboratorCount: 0,
    locationCount: 0,
    countries: [],
    hasDmc: null,
    meshTerms: [],
  };
}

describe("TrialEligibilityMatcher", () => {
  it("matches criteria when every meaningful token appears in the trial criteria", () => {
    const result = matchEligibilityCriteria(
      [{ description: "Adults with type-2 diabetes", conceptId: "C001" }],
      [{ description: "prior insulin therapy" }],
      [
        trial("NCT000001", "Adults with type 2 diabetes may enroll. Prior insulin therapy is excluded."),
        trial("NCT000002", "Adults with hypertension may enroll."),
      ]
    );

    expect(result.inclusion).toEqual([
      {
        description: "Adults with type-2 diabetes",
        conceptId: "C001",
        poolMatchPct: 50,
        matchingTrialIds: ["NCT000001"],
      },
    ]);
    expect(result.exclusion).toEqual([
      {
        description: "prior insulin therapy",
        conceptId: null,
        poolMatchPct: 50,
        matchingTrialIds: ["NCT000001"],
      },
    ]);
  });

  it("ignores stop words and punctuation when matching", () => {
    const result = matchEligibilityCriteria(
      [{ description: "The patient must have renal_failure" }],
      [],
      [trial("NCT000003", "Patient has renal failure.")]
    );

    expect(result.inclusion[0].matchingTrialIds).toEqual(["NCT000003"]);
    expect(result.inclusion[0].poolMatchPct).toBe(100);
  });

  it("returns empty comparisons when there is no pool or no criteria", () => {
    expect(matchEligibilityCriteria([{ description: "diabetes" }], [], [])).toEqual({
      inclusion: [],
      exclusion: [],
    });
    expect(matchEligibilityCriteria([], [], [trial("NCT000004", "Adults with diabetes")])).toEqual({
      inclusion: [],
      exclusion: [],
    });
  });

  it("does not match empty descriptions or trials with blank eligibility criteria", () => {
    const result = matchEligibilityCriteria(
      [{ description: "and the for" }, { description: "diabetes" }],
      [],
      [trial("NCT000005", ""), trial("NCT000006", "Adults with diabetes")]
    );

    expect(result.inclusion[0].matchingTrialIds).toEqual([]);
    expect(result.inclusion[0].poolMatchPct).toBe(0);
    expect(result.inclusion[1].matchingTrialIds).toEqual(["NCT000006"]);
    expect(result.inclusion[1].poolMatchPct).toBe(50);
  });
});
