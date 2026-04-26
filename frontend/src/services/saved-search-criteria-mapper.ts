import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";
import { DesignModel } from "../models/design-model";

export interface DesignerDefaults {
  phase?: string;
  allocationType: string;
  interventionModels?: string[];
  blindingType: string;
  blindingTypes?: string[];
  sex: string;
  phases?: string[];
  allocations?: string[];
  sexes?: string[];
}

export interface DesignerFormValue {
  condition?: string | null;
  phase?: string | null;
  allocationType?: string | null;
  interventionModel?: string | null;
  blindingType?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  sex?: string | null;
  required?: string[] | null;
  ineligible?: string[] | null;

  // User Trial Specifics
  userPatients?: number | null;
  userSites?: number | null;
  userInclusions?: number | null;
  userExclusions?: number | null;
  userOutcomes?: number | null;
  userArms?: number | null;

  // Refinement state
  selectedTrialIds?: string[];
}

export interface SearchExecutionMappings {
  phaseByLabel: Record<string, string>;
  interventionModelByLabel: Record<string, string>;
}

function resolveOptionValue(
  value: string | undefined,
  options: string[] | undefined,
  fallback: string
): string {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();
  const matched = options?.find(option => option.trim().toLowerCase() === normalizedValue);
  return matched ?? value;
}

export function mapDesignModelToSavedSearchCriteria(
  input: DesignerFormValue
): ClinicalTrialSearchRequest {
  return {
    ...(input.condition ? { condition: input.condition } : {}),
    ...(input.phase ? { phase: input.phase } : {}),
    ...(input.allocationType ? { allocationType: input.allocationType } : {}),
    ...(input.interventionModel ? { interventionModel: input.interventionModel } : {}),
    ...(input.blindingType ? { blindingType: input.blindingType } : {}),
    ...(input.minAge != null ? { minAge: input.minAge } : {}),
    ...(input.maxAge != null ? { maxAge: input.maxAge } : {}),
    ...(input.sex ? { sex: input.sex } : {}),
    ...(input.required?.length ? { requiredConditions: input.required } : {}),
    ...(input.ineligible?.length ? { ineligibleConditions: input.ineligible } : {}),

    // User Trial Specifics
    userPatients: input.userPatients ?? null,
    userSites: input.userSites ?? null,
    userInclusions: input.userInclusions ?? null,
    userExclusions: input.userExclusions ?? null,
    userOutcomes: input.userOutcomes ?? null,
    userArms: input.userArms ?? null,

    // Refinement state
    selectedTrialIds: input.selectedTrialIds ?? [],
  };
}

export function mapDesignModelToExecutionSearchRequest(
  input: DesignerFormValue,
  mappings: SearchExecutionMappings
): ClinicalTrialSearchRequest {
  const criteria = mapDesignModelToSavedSearchCriteria(input);

  return {
    ...criteria,
    phase: criteria.phase ? mappings.phaseByLabel[criteria.phase] ?? criteria.phase : undefined,
    interventionModel: criteria.interventionModel
      ? mappings.interventionModelByLabel[criteria.interventionModel] ?? criteria.interventionModel
      : undefined,
  };
}

export function mapSavedSearchCriteriaToDesignModel(
  criteria: ClinicalTrialSearchRequest,
  defaults: DesignerDefaults
): DesignModel {
  return {
    condition: criteria.condition ?? "",
    phase: resolveOptionValue(criteria.phase, defaults.phases, defaults.phase ?? ""),
    allocationType: resolveOptionValue(criteria.allocationType, defaults.allocations, defaults.allocationType),
    interventionModel: criteria.interventionModel
      ? resolveOptionValue(criteria.interventionModel, defaults.interventionModels, criteria.interventionModel)
      : null,
    blindingType: resolveOptionValue(criteria.blindingType, defaults.blindingTypes, defaults.blindingType),
    minAge: criteria.minAge ?? null,
    maxAge: criteria.maxAge ?? null,
    sex: resolveOptionValue(criteria.sex, defaults.sexes, defaults.sex),
    required: criteria.requiredConditions ?? [],
    ineligible: criteria.ineligibleConditions ?? [],

    // User Trial Specifics
    userPatients: criteria.userPatients ?? null,
    userSites: criteria.userSites ?? null,
    userInclusions: criteria.userInclusions ?? null,
    userExclusions: criteria.userExclusions ?? null,
    userOutcomes: criteria.userOutcomes ?? null,
    userArms: criteria.userArms ?? null,

    // Eligibility criteria for benchmark comparison
    inclusionCriteria: [],
    exclusionCriteria: [],

    // Refinement state
    selectedTrialIds: criteria.selectedTrialIds ?? [],
  };
}