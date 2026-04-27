import { DesignModel } from "../models/design-model";

export interface DesignerImportDefaults {
  phase: string;
  phases: string[];
  allocationType: string;
  allocations: string[];
  interventionModels: string[];
  blindingType: string;
  blindingTypes: string[];
  sex: string;
  sexes: string[];
}

interface JsonCriteriaEnvelope {
  format?: string;
  version?: number;
  criteria?: unknown;
}

function resolveOptionValue(
  value: string | null | undefined,
  options: string[],
  fallback: string
): string {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return options.find(option => option.trim().toLowerCase() === normalized) ?? value;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDesignModelLike(value: unknown): value is Partial<DesignModel> {
  return typeof value === "object" && value !== null;
}

export function buildDesignerExportJson(criteria: DesignModel): string {
  return JSON.stringify(
    {
      format: "clinicaltrials-designer-criteria",
      version: 1,
      criteria,
    },
    null,
    2
  );
}

export function parseDesignerCriteriaFile(
  content: string,
  filename: string,
  defaults: DesignerImportDefaults
): DesignModel {
  const normalizedName = filename.trim().toLowerCase();

  if (normalizedName.endsWith(".json")) {
    return parseDesignerJson(content, defaults);
  }

  throw new Error(`Unsupported criteria file format: ${filename}`);
}

export function parseDesignerJson(content: string, defaults: DesignerImportDefaults): DesignModel {
  const parsed = JSON.parse(content) as JsonCriteriaEnvelope | Partial<DesignModel>;
  const candidate = isDesignModelLike((parsed as JsonCriteriaEnvelope).criteria)
    ? (parsed as JsonCriteriaEnvelope).criteria as Partial<DesignModel>
    : parsed as Partial<DesignModel>;

  return normalizeImportedCriteria(candidate, defaults);
}
export function normalizeImportedCriteria(
  input: Partial<DesignModel>,
  defaults: DesignerImportDefaults
): DesignModel {
  return {
    condition: typeof input.condition === "string" ? input.condition.trim() : "",
    phase: resolveOptionValue(input.phase, defaults.phases, defaults.phase),
    allocationType: resolveOptionValue(input.allocationType, defaults.allocations, defaults.allocationType),
    interventionModel: input.interventionModel
      ? resolveOptionValue(input.interventionModel, defaults.interventionModels, input.interventionModel)
      : null,
    blindingType: resolveOptionValue(input.blindingType, defaults.blindingTypes, defaults.blindingType),
    minAge: toNullableNumber(input.minAge),
    maxAge: toNullableNumber(input.maxAge),
    sex: resolveOptionValue(input.sex, defaults.sexes, defaults.sex),
    required: Array.isArray(input.required)
      ? input.required.map(item => String(item).trim()).filter(Boolean)
      : [],
    ineligible: Array.isArray(input.ineligible)
      ? input.ineligible.map(item => String(item).trim()).filter(Boolean)
      : [],

    startDateFrom: typeof input.startDateFrom === "string" ? input.startDateFrom.trim() : null,
    startDateTo: typeof input.startDateTo === "string" ? input.startDateTo.trim() : null,

    // User Trial Specifics
    userPatients: toNullableNumber(input.userPatients),
    userSites: toNullableNumber(input.userSites),
    userInclusions: toNullableNumber(input.userInclusions),
    userExclusions: toNullableNumber(input.userExclusions),
    userOutcomes: toNullableNumber(input.userOutcomes),
    userArms: toNullableNumber(input.userArms),

    // Eligibility criteria for benchmark comparison
    inclusionCriteria: Array.isArray(input.inclusionCriteria) ? input.inclusionCriteria : [],
    exclusionCriteria: Array.isArray(input.exclusionCriteria) ? input.exclusionCriteria : [],
  };
}