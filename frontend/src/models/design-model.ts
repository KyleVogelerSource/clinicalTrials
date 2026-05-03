import { EligibilityCriterion } from '@shared/dto/TrialResultsRequest';

export interface MatrixOperators {
    highEnrollment: '>' | '<';
    multiSite: '>' | '<';
    longDuration: '>' | '<';
    manyArms: '>' | '<';
    strictInclusions: '>' | '<';
    manyInterventions: '>' | '<';
    manyOutcomes: '>' | '<';
    wideAgeSpan: '>' | '<';
}

export interface MatrixThresholds {
    highEnrollment: number;
    multiSite: number;
    longDuration: number;
    manyArms: number;
    strictInclusions: number;
    manyInterventions: number;
    manyOutcomes: number;
    wideAgeSpan: number;
    operators: MatrixOperators;
}

export interface DesignModel {
    condition: string,
    phase: string[],
    allocationType: string[],
    interventionModel: string[],
    blindingType: string[],
    minAge: number | null,
    maxAge: number | null,
    sex: string,
    required: string[],
    ineligible: string[],

    // Year range filters
    startDateFrom?: string | null,
    startDateTo?: string | null,

    // User Trial Specifics
    userPatients: number | null,
    userSites: number | null,
    userInclusions: number | null,
    userExclusions: number | null,
    userOutcomes: number | null,
    userArms: number | null,
    userDuration: number | null,

    // Eligibility criteria for benchmark comparison
    inclusionCriteria: EligibilityCriterion[],
    exclusionCriteria: EligibilityCriterion[],

    // Refinement state
    selectedTrialIds?: string[],

    // Analysis UI State
    matrixThresholds?: MatrixThresholds;
}