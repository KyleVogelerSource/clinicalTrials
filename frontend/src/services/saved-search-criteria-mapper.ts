import { ClinicalTrialSearchRequest } from "@shared/dto/ClinicalTrialSearchRequest";
import { DesignModel } from "../models/design-model";

export interface DesignerFormValue {
  condition?: string | null;
  phase?: string[] | string | null;
  allocationType?: string[] | string | null;
  interventionModel?: string[] | string | null;
  blindingType?: string[] | string | null;
  minAge?: number | null;
  maxAge?: number | null;
  sex?: string[] | string | null;

  // Year range filters
  startDateFrom?: string | null;
  startDateTo?: string | null;

  // User Trial Specifics
  userPatients?: number | null;
  userSites?: number | null;
  userInclusions?: number | null;
  userExclusions?: number | null;
  userOutcomes?: number | null;
  userArms?: number | null;

  // Refinement state
  selectedTrialIds?: string[];

  // Eligibility criteria for benchmark comparison
  inclusionCriteria?: any[];
  exclusionCriteria?: any[];
}

export interface DesignerDefaults {
  phase?: string;
  phases: string[];
  allocationType: string;
  allocations: string[];
  interventionModels: string[];
  blindingType: string;
  blindingTypes: string[];
  sex: string;
  sexes: string[];
}

export const PHASE_MAP: Record<string, string> = {
    'Early Phase 1': 'EARLY_PHASE1',
    'Phase 1': 'PHASE1',
    'Phase 2': 'PHASE2',
    'Phase 3': 'PHASE3',
    'Phase 4': 'PHASE4',
    'N/A': 'NA'
};

export const ALLOCATION_MAP: Record<string, string> = {
    'Randomized': 'RANDOMIZED',
    'Non-Randomized': 'NON_RANDOMIZED',
    'N/A': 'NA'
};

export const INTERVENTION_MODEL_MAP: Record<string, string> = {
    'Single Group Assignment': 'SINGLE_GROUP',
    'Parallel Assignment': 'PARALLEL',
    'Crossover Assignment': 'CROSSOVER',
    'Factorial Assignment': 'FACTORIAL',
    'Sequential Assignment': 'SEQUENTIAL'
};

export const BLINDING_MAP: Record<string, string> = {
    'None (Open Label)': 'NONE',
    'Single': 'SINGLE',
    'Double': 'DOUBLE',
    'Triple': 'TRIPLE',
    'Quadruple': 'QUADRUPLE'
};

export const SEX_MAP: Record<string, string> = {
    'Male': 'MALE',
    'Female': 'FEMALE',
    'All': 'ALL'
};

export interface SearchExecutionMappings {
  phaseByLabel: Record<string, string>;
  interventionModelByLabel: Record<string, string>;
  allocationByLabel?: Record<string, string>;
  blindingByLabel?: Record<string, string>;
  sexByLabel?: Record<string, string>;
}

export const EXECUTION_MAPPINGS: SearchExecutionMappings = {
    phaseByLabel: PHASE_MAP,
    interventionModelByLabel: INTERVENTION_MODEL_MAP,
    allocationByLabel: ALLOCATION_MAP,
    blindingByLabel: BLINDING_MAP,
    sexByLabel: SEX_MAP
};

export function resolveOptionValue(
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

export function resolveMultiOptionValue(
    value: string[] | string | undefined | null,
    options: string[] | undefined,
    mapping?: Record<string, string>
): string[] {
    if (!value) return [];
    
    // 1. Normalize to array
    const arr = Array.isArray(value) ? value : value.split(' OR ').map(s => s.trim()).filter(Boolean);
    
    // 2. Create reverse mapping for code -> label lookups
    const reverseMap: Record<string, string> = {};
    if (mapping) {
        for (const [k, v] of Object.entries(mapping)) {
            reverseMap[v] = k;
        }
    }

    // 3. Map each item to its canonical label
    const labels = arr.map(v => {
        // Try reverse mapping (code -> label)
        if (reverseMap[v]) return reverseMap[v];
        
        // Try matching against options (handles labels already in array/string)
        const normalized = v.toLowerCase();
        const matched = options?.find(o => o.toLowerCase() === normalized);
        if (matched) return matched;

        // Fallback to original
        return v;
    });

    // 4. Deduplicate
    return Array.from(new Set(labels));
}

export function mapMultiValue(
    value: string[] | string | undefined | null,
    mapping?: Record<string, string>
): string | undefined {
    if (!value) return undefined;
    
    // 1. Normalize to labels and deduplicate
    // Important: we pass undefined for mapping here to get purely labels first
    const labels = resolveMultiOptionValue(value, undefined, undefined);
    if (labels.length === 0) return undefined;
    
    // 2. Map to codes if mapping provided
    if (mapping) {
        return labels.map(l => mapping[l] ?? l).join(' OR ');
    }
    
    // 3. Otherwise return labels joined
    return labels.join(' OR ');
}

export function mapSexValue(
    value: string[] | string | undefined | null,
    mapping?: Record<string, string>
): string | undefined {
    if (!value) return undefined;
    const labels = resolveMultiOptionValue(value, undefined, undefined);
    if (labels.length === 0) return undefined;

    // If both Male and Female (or 'All') are selected, return 'ALL'
    const hasMale = labels.some(l => l.toLowerCase() === 'male');
    const hasFemale = labels.some(l => l.toLowerCase() === 'female');
    const hasAll = labels.some(l => l.toLowerCase() === 'all');

    if (hasAll || (hasMale && hasFemale)) {
        return mapping ? (mapping['All'] ?? 'ALL') : 'All';
    }

    if (hasMale) return mapping ? (mapping['Male'] ?? 'MALE') : 'Male';
    if (hasFemale) return mapping ? (mapping['Female'] ?? 'FEMALE') : 'Female';

    return undefined;
}

export function mapDesignModelToSavedSearchCriteria(
  input: DesignerFormValue
): ClinicalTrialSearchRequest {
  return {
    ...(input.condition ? { condition: input.condition } : {}),
    phase: mapMultiValue(input.phase),
    allocationType: mapMultiValue(input.allocationType),
    interventionModel: mapMultiValue(input.interventionModel),
    blindingType: mapMultiValue(input.blindingType),
    ...(input.minAge != null ? { minAge: input.minAge } : {}),
    ...(input.maxAge != null ? { maxAge: input.maxAge } : {}),
    sex: mapSexValue(input.sex),
    
    ...(input.startDateFrom ? { startDateFrom: input.startDateFrom } : {}),
    ...(input.startDateTo ? { startDateTo: input.startDateTo } : {}),

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
  mappings: SearchExecutionMappings = EXECUTION_MAPPINGS
): ClinicalTrialSearchRequest {
  const criteria = mapDesignModelToSavedSearchCriteria(input);

  return {
    ...criteria,
    phase: mapMultiValue(input.phase, mappings.phaseByLabel),
    interventionModel: mapMultiValue(input.interventionModel, mappings.interventionModelByLabel),
    allocationType: mapMultiValue(input.allocationType, mappings.allocationByLabel),
    blindingType: mapMultiValue(input.blindingType, mappings.blindingByLabel),
    sex: mapSexValue(input.sex, mappings.sexByLabel)
  };
}

export function mapSavedSearchCriteriaToDesignModel(
  criteria: ClinicalTrialSearchRequest,
  defaults: DesignerDefaults
): DesignModel {
  return {
    condition: criteria.condition ?? "",
    phase: resolveMultiOptionValue(criteria.phase, defaults.phases, PHASE_MAP),
    allocationType: resolveMultiOptionValue(criteria.allocationType, defaults.allocations, ALLOCATION_MAP),
    interventionModel: resolveMultiOptionValue(criteria.interventionModel, defaults.interventionModels, INTERVENTION_MODEL_MAP),
    blindingType: resolveMultiOptionValue(criteria.blindingType, defaults.blindingTypes, BLINDING_MAP),
    minAge: criteria.minAge ?? null,
    maxAge: criteria.maxAge ?? null,
    sex: resolveOptionValue(criteria.sex, defaults.sexes, defaults.sex),

    startDateFrom: criteria.startDateFrom ?? null,
    startDateTo: criteria.startDateTo ?? null,

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