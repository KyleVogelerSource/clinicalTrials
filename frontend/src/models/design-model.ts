import { EligibilityCriterion } from '@shared/dto/TrialResultsRequest';

export interface DesignModel {
    condition: string,
    phase: string,
    allocationType: string,
    interventionModel: string | null,
    blindingType: string,
    minAge: number | null,
    maxAge: number | null,
    sex: string,
    required: string[],
    ineligible: string[],

    // User Trial Specifics
    userPatients: number | null,
    userSites: number | null,
    userInclusions: number | null,
    userExclusions: number | null,
    userOutcomes: number | null,
    userArms: number | null,

    // Eligibility criteria for benchmark comparison
    inclusionCriteria: EligibilityCriterion[],
    exclusionCriteria: EligibilityCriterion[],

    // Refinement state
    selectedTrialIds?: string[],
}