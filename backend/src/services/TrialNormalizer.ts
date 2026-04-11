import { ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { NormalizedTrial } from "../models/NormalizedTrial";

const PHASE_ORDER = ["PHASE4", "PHASE3", "PHASE2", "PHASE1", "EARLY_PHASE1", "NA"];

const MONTH_MAP: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

export function normalizePhase(phases: string[]): string {
  const upper = phases.map((phase) => phase.toUpperCase().replace(/\s+/g, "_"));
  for (const candidate of PHASE_ORDER) {
    if (upper.includes(candidate)) {
      return candidate;
    }
  }
  return upper[0] ?? "NA";
}

export function normalizeDate(raw?: string): string | null {
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const monthYearMatch = raw.match(/^(\w+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    if (month) {
      return `${monthYearMatch[2]}-${month}`;
    }
  }

  return null;
}

function normalizeString(value?: string, fallback = "UNKNOWN"): string {
  if (!value || value.trim() === "") {
    return fallback;
  }

  return value.trim().toUpperCase();
}

function normalizeEnrollmentType(type?: string): "ACTUAL" | "ESTIMATED" {
  return type?.toUpperCase() === "ACTUAL" ? "ACTUAL" : "ESTIMATED";
}

function extractInterventionNames(study: ClinicalTrialStudy): string[] {
  return (study.protocolSection.armsInterventionsModule?.interventions ?? [])
    .map((intervention: { name?: string }) => intervention.name)
    .filter((name: string | undefined): name is string => Boolean(name));
}

function extractPrimaryOutcomes(study: ClinicalTrialStudy): string[] {
  return (study.protocolSection.outcomesModule?.primaryOutcomes ?? [])
    .map((outcome: { measure?: string }) => outcome.measure)
    .filter((measure: string | undefined): measure is string => Boolean(measure));
}

export function normalizeTrialStudy(study: ClinicalTrialStudy): NormalizedTrial {
  const protocol = study.protocolSection;
  const identification = protocol.identificationModule;
  const status = protocol.statusModule;
  const design = protocol.designModule;
  const eligibility = protocol.eligibilityModule;

  return {
    nctId: identification.nctId,
    briefTitle: identification.briefTitle,
    phase: normalizePhase(design?.phases ?? []),
    studyType: normalizeString(design?.studyType),
    overallStatus: normalizeString(status?.overallStatus),
    enrollmentCount: design?.enrollmentInfo?.count ?? 0,
    enrollmentType: normalizeEnrollmentType(design?.enrollmentInfo?.type),
    startDate: normalizeDate(status?.startDateStruct?.date),
    completionDate: normalizeDate(status?.completionDateStruct?.date),
    conditions: protocol.conditionsModule?.conditions ?? [],
    interventions: extractInterventionNames(study),
    eligibilityCriteria: eligibility?.eligibilityCriteria?.trim() ?? "",
    sex: normalizeString(eligibility?.sex, "ALL"),
    minimumAge: eligibility?.minimumAge ?? null,
    maximumAge: eligibility?.maximumAge ?? null,
    primaryOutcomes: extractPrimaryOutcomes(study),
    sponsor: protocol.sponsorCollaboratorsModule?.leadSponsor?.name ?? null,
  };
}
