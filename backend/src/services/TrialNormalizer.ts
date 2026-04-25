import { ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { NormalizedTrial } from "../models/NormalizedTrial";

const PHASE_ORDER = ["PHASE4", "PHASE3", "PHASE2", "PHASE1", "EARLY_PHASE1", "NA"];

const MONTH_MAP: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

export function normalizePhase(phases: string[]): string {
  const upper = phases.map((phase) => phase.toUpperCase().replace(/\s+/g, "_"));
  for (const candidate of PHASE_ORDER) {
    if (upper.includes(candidate)) return candidate;
  }
  return upper[0] ?? "NA";
}

export function normalizeDate(raw?: string): string | null {
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const monthYearMatch = raw.match(/^(\w+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    if (month) return `${monthYearMatch[2]}-${month}`;
  }
  return null;
}

function normalizeString(value?: string, fallback = "UNKNOWN"): string {
  if (!value || value.trim() === "") return fallback;
  return value.trim().toUpperCase();
}

function normalizeEnrollmentType(type?: string): "ACTUAL" | "ESTIMATED" {
  return type?.toUpperCase() === "ACTUAL" ? "ACTUAL" : "ESTIMATED";
}

function extractInterventionNames(study: ClinicalTrialStudy): string[] {
  return (study.protocolSection.armsInterventionsModule?.interventions ?? [])
    .map((i) => i.name)
    .filter((n): n is string => Boolean(n));
}

function extractInterventionTypes(study: ClinicalTrialStudy): string[] {
  const raw = (study.protocolSection.armsInterventionsModule?.interventions ?? [])
    .map((i) => i.type)
    .filter((t): t is string => Boolean(t));
  return [...new Set(raw.map((t) => t.toUpperCase()))];
}

function extractPrimaryOutcomes(study: ClinicalTrialStudy): string[] {
  return (study.protocolSection.outcomesModule?.primaryOutcomes ?? [])
    .map((o) => o.measure)
    .filter((m): m is string => Boolean(m));
}

function extractSecondaryOutcomes(study: ClinicalTrialStudy): string[] {
  return (study.protocolSection.outcomesModule?.secondaryOutcomes ?? [])
    .map((o) => o.measure)
    .filter((m): m is string => Boolean(m));
}

function extractCountries(study: ClinicalTrialStudy): string[] {
  const locations = study.protocolSection.contactsLocationsModule?.locations ?? [];
  const raw = locations
    .map((l) => l.country)
    .filter((c): c is string => Boolean(c));
  return [...new Set(raw)];
}

function extractMeshTerms(study: ClinicalTrialStudy): string[] {
  const meshes = study.derivedSection?.conditionBrowseModule?.meshes ?? [];
  return meshes
    .map((m) => m.term)
    .filter((t): t is string => Boolean(t));
}

export function normalizeTrialStudy(study: ClinicalTrialStudy): NormalizedTrial {
  const protocol = study.protocolSection;
  const identification = protocol.identificationModule;
  const status = protocol.statusModule;
  const design = protocol.designModule;
  const designInfo = design?.designInfo;
  const eligibility = protocol.eligibilityModule;
  const sponsors = protocol.sponsorCollaboratorsModule;
  const locations = protocol.contactsLocationsModule?.locations ?? [];

  return {
    // Identification
    nctId: identification.nctId,
    briefTitle: identification.briefTitle,
    officialTitle: identification.officialTitle ?? null,
    acronym: identification.acronym ?? null,

    // Status
    phase: normalizePhase(design?.phases ?? []),
    studyType: normalizeString(design?.studyType),
    overallStatus: normalizeString(status?.overallStatus),
    whyStopped: status?.whyStopped ?? null,
    hasResults: study.hasResults ?? false,

    // Enrollment
    enrollmentCount: design?.enrollmentInfo?.count ?? 0,
    enrollmentType: normalizeEnrollmentType(design?.enrollmentInfo?.type),

    // Dates
    startDate: normalizeDate(status?.startDateStruct?.date),
    completionDate: normalizeDate(status?.completionDateStruct?.date),

    // Design
    allocation: designInfo?.allocation ?? null,
    interventionModel: designInfo?.interventionModel ?? null,
    primaryPurpose: designInfo?.primaryPurpose ?? null,
    masking: designInfo?.maskingInfo?.masking ?? null,
    whoMasked: designInfo?.maskingInfo?.whoMasked ?? [],

    // Arms & Interventions
    conditions: protocol.conditionsModule?.conditions ?? [],
    interventions: extractInterventionNames(study),
    interventionTypes: extractInterventionTypes(study),
    armCount: protocol.armsInterventionsModule?.armGroups?.length ?? 0,

    // Eligibility
    eligibilityCriteria: eligibility?.eligibilityCriteria?.trim() ?? "",
    sex: normalizeString(eligibility?.sex, "ALL"),
    minimumAge: eligibility?.minimumAge ?? null,
    maximumAge: eligibility?.maximumAge ?? null,
    healthyVolunteers: eligibility?.healthyVolunteers ?? null,
    stdAges: eligibility?.stdAges ?? [],

    // Outcomes
    primaryOutcomes: extractPrimaryOutcomes(study),
    secondaryOutcomes: extractSecondaryOutcomes(study),

    // Sponsors & Sites
    sponsor: sponsors?.leadSponsor?.name ?? null,
    sponsorClass: sponsors?.leadSponsor?.class ?? null,
    collaboratorCount: sponsors?.collaborators?.length ?? 0,
    locationCount: locations.length,
    countries: extractCountries(study),

    // Oversight
    hasDmc: protocol.oversightModule?.oversightHasDmc ?? null,
    meshTerms: extractMeshTerms(study),
  };
}