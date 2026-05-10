import { describe, expect, it } from "vitest";
import { ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { normalizeDate, normalizePhase, normalizeTrialStudy } from "./TrialNormalizer";

describe("TrialNormalizer", () => {
  it("normalizes phase values by priority and falls back to NA", () => {
    expect(normalizePhase(["PHASE1", "PHASE3"])).toBe("PHASE3");
    expect(normalizePhase(["Phase 1", "Phase 3"])).toBe("PHASE_1");
    expect(normalizePhase(["Early Phase 1"])).toBe("EARLY_PHASE_1");
    expect(normalizePhase([])).toBe("NA");
  });

  it("normalizes supported date formats", () => {
    expect(normalizeDate("2026-04-17")).toBe("2026-04");
    expect(normalizeDate("March 2025")).toBe("2025-03");
    expect(normalizeDate("Not a date")).toBeNull();
    expect(normalizeDate()).toBeNull();
  });

  it("extracts normalized trial fields from a rich ClinicalTrials.gov study", () => {
    const study: ClinicalTrialStudy = {
      hasResults: true,
      protocolSection: {
        identificationModule: {
          nctId: "NCT000001",
          briefTitle: "Brief",
          officialTitle: "Official",
          acronym: "ABC",
        },
        statusModule: {
          overallStatus: " completed ",
          whyStopped: "Stopped early",
          startDateStruct: { date: "January 2020" },
          completionDateStruct: { date: "2022-06-01" },
        },
        designModule: {
          studyType: " interventional ",
          phases: ["Phase 2", "Phase 4"],
          enrollmentInfo: { count: 120, type: "Actual" },
          designInfo: {
            allocation: "Randomized",
            interventionModel: "Parallel",
            primaryPurpose: "Treatment",
            maskingInfo: {
              masking: "Double",
              whoMasked: ["Participant", "Investigator"],
            },
          },
        },
        conditionsModule: { conditions: ["Diabetes"] },
        armsInterventionsModule: {
          armGroups: [{ label: "Arm A" }, { label: "Arm B" }],
          interventions: [
            { name: "Drug A", type: "Drug" },
            { name: "Device B", type: "Device" },
            { name: undefined, type: "Drug" },
          ],
        },
        eligibilityModule: {
          eligibilityCriteria: "  Adults only  ",
          sex: " female ",
          minimumAge: "18 Years",
          maximumAge: "65 Years",
          healthyVolunteers: false,
          stdAges: ["Adult"],
        },
        outcomesModule: {
          primaryOutcomes: [{ measure: "A1C" }, { measure: undefined }],
          secondaryOutcomes: [{ measure: "Weight" }],
        },
        sponsorCollaboratorsModule: {
          leadSponsor: { name: "NIH", class: "NIH" },
          collaborators: [{ name: "Partner" }],
        },
        contactsLocationsModule: {
          locations: [{ country: "United States" }, { country: "Canada" }, { country: "United States" }],
        },
        oversightModule: {
          oversightHasDmc: true,
        },
      },
      derivedSection: {
        conditionBrowseModule: {
          meshes: [{ term: "Diabetes Mellitus" }, { term: undefined }],
        },
      },
    } as ClinicalTrialStudy;

    expect(normalizeTrialStudy(study)).toEqual(
      expect.objectContaining({
        nctId: "NCT000001",
        briefTitle: "Brief",
        officialTitle: "Official",
        acronym: "ABC",
        phase: "PHASE_2",
        studyType: "INTERVENTIONAL",
        overallStatus: "COMPLETED",
        whyStopped: "Stopped early",
        hasResults: true,
        enrollmentCount: 120,
        enrollmentType: "ACTUAL",
        startDate: "2020-01",
        completionDate: "2022-06",
        allocation: "Randomized",
        interventionModel: "Parallel",
        primaryPurpose: "Treatment",
        masking: "Double",
        whoMasked: ["Participant", "Investigator"],
        conditions: ["Diabetes"],
        interventions: ["Drug A", "Device B"],
        interventionTypes: ["DRUG", "DEVICE"],
        armCount: 2,
        eligibilityCriteria: "Adults only",
        sex: "FEMALE",
        minimumAge: "18 Years",
        maximumAge: "65 Years",
        healthyVolunteers: false,
        stdAges: ["Adult"],
        primaryOutcomes: ["A1C"],
        secondaryOutcomes: ["Weight"],
        sponsor: "NIH",
        sponsorClass: "NIH",
        collaboratorCount: 1,
        locationCount: 3,
        countries: ["United States", "Canada"],
        hasDmc: true,
        meshTerms: ["Diabetes Mellitus"],
      })
    );
  });

  it("fills defaults when optional ClinicalTrials.gov modules are absent", () => {
    const normalized = normalizeTrialStudy({
      protocolSection: {
        identificationModule: {
          nctId: "NCTEMPTY",
          briefTitle: "Sparse",
        },
      },
    } as ClinicalTrialStudy);

    expect(normalized).toEqual(
      expect.objectContaining({
        nctId: "NCTEMPTY",
        phase: "NA",
        studyType: "UNKNOWN",
        overallStatus: "UNKNOWN",
        hasResults: false,
        enrollmentCount: 0,
        enrollmentType: "ESTIMATED",
        startDate: null,
        completionDate: null,
        interventions: [],
        interventionTypes: [],
        eligibilityCriteria: "",
        sex: "ALL",
        primaryOutcomes: [],
        secondaryOutcomes: [],
        countries: [],
        meshTerms: [],
      })
    );
  });
});
