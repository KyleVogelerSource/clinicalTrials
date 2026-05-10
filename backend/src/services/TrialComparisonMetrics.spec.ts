import { describe, expect, it } from "vitest";
import { NormalizedTrial } from "../models/NormalizedTrial";
import { buildComparisonMetrics } from "./TrialComparisonMetrics";

function trial(overrides: Partial<NormalizedTrial> = {}): NormalizedTrial {
  return {
    nctId: "NCT000001",
    briefTitle: "Reference trial",
    officialTitle: null,
    acronym: null,
    phase: "PHASE2",
    studyType: "INTERVENTIONAL",
    overallStatus: "COMPLETED",
    whyStopped: null,
    hasResults: true,
    enrollmentCount: 120,
    enrollmentType: "ACTUAL",
    startDate: "2020-01",
    completionDate: "2021-01",
    allocation: "RANDOMIZED",
    interventionModel: "PARALLEL",
    primaryPurpose: "TREATMENT",
    masking: "DOUBLE",
    whoMasked: ["Participant", "Investigator"],
    conditions: ["Diabetes"],
    interventions: ["Metformin", "Placebo"],
    interventionTypes: ["DRUG"],
    armCount: 2,
    eligibilityCriteria: "Adults with diabetes",
    sex: "ALL",
    minimumAge: "18 Years",
    maximumAge: "65 Years",
    healthyVolunteers: false,
    stdAges: ["ADULT", "OLDER_ADULT"],
    primaryOutcomes: ["A1C change"],
    secondaryOutcomes: ["Weight change"],
    sponsor: "NIH",
    sponsorClass: "NIH",
    collaboratorCount: 1,
    locationCount: 3,
    countries: ["United States", "Canada"],
    hasDmc: true,
    meshTerms: ["Diabetes Mellitus"],
    ...overrides,
  };
}

function metricValue(trial: NormalizedTrial, metric: string) {
  return buildComparisonMetrics([trial]).find((entry) => entry.metric === metric)?.value;
}

describe("TrialComparisonMetrics", () => {
  it("builds one metric row per supported metric for each trial", () => {
    const entries = buildComparisonMetrics([
      trial({ nctId: "NCT000001" }),
      trial({ nctId: "NCT000002", briefTitle: "Second trial" }),
    ]);

    expect(entries).toHaveLength(74);
    expect(entries.filter((entry) => entry.nctId === "NCT000001")).toHaveLength(37);
    expect(entries.filter((entry) => entry.nctId === "NCT000002")).toHaveLength(37);
  });

  it("extracts scalar, joined list, boolean, count, and duration values", () => {
    const subject = trial();

    expect(metricValue(subject, "phase")).toBe("PHASE2");
    expect(metricValue(subject, "hasResults")).toBe("Yes");
    expect(metricValue(subject, "healthyVolunteers")).toBe("No");
    expect(metricValue(subject, "hasDmc")).toBe("Yes");
    expect(metricValue(subject, "whoMasked")).toBe("Participant, Investigator");
    expect(metricValue(subject, "interventions")).toBe("Metformin; Placebo");
    expect(metricValue(subject, "countries")).toBe("United States, Canada");
    expect(metricValue(subject, "primaryOutcomeCount")).toBe(1);
    expect(metricValue(subject, "durationDays")).toBeGreaterThan(360);
  });

  it("returns null for missing optional values, empty lists, zero counts, and invalid durations", () => {
    const sparse = trial({
      acronym: null,
      enrollmentCount: 0,
      startDate: "2021-01",
      completionDate: "2020-01",
      whoMasked: [],
      interventions: [],
      interventionTypes: [],
      conditions: [],
      meshTerms: [],
      locationCount: 0,
      healthyVolunteers: null,
      hasDmc: null,
      primaryOutcomes: [],
      secondaryOutcomes: [],
    });

    expect(metricValue(sparse, "acronym")).toBeNull();
    expect(metricValue(sparse, "enrollmentCount")).toBeNull();
    expect(metricValue(sparse, "durationDays")).toBeNull();
    expect(metricValue(sparse, "whoMasked")).toBeNull();
    expect(metricValue(sparse, "interventionTypes")).toBeNull();
    expect(metricValue(sparse, "interventions")).toBeNull();
    expect(metricValue(sparse, "conditions")).toBeNull();
    expect(metricValue(sparse, "meshTerms")).toBeNull();
    expect(metricValue(sparse, "locationCount")).toBeNull();
    expect(metricValue(sparse, "healthyVolunteers")).toBeNull();
    expect(metricValue(sparse, "hasDmc")).toBeNull();
    expect(metricValue(sparse, "primaryOutcomeCount")).toBe(0);
    expect(metricValue(sparse, "primaryOutcomes")).toBeNull();
  });
});
