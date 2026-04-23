export interface TrialResultsRequest {
    condition: string | null;
    phase: string | null;
    allocationType: string | null;
    interventionModel: string | null;
    blindingType: string | null;
    minAge: number | null;
    maxAge: number | null;
    sex: string | null;
    requiredConditions: string[];
    ineligibleConditions: string[];
    selectedTrialIds: string[];
    inclusionCriteria: EligibilityCriterion[];
    exclusionCriteria: EligibilityCriterion[];
}

export interface EligibilityCriterion {
    conceptId?: string | null;
    description: string;   // Human-readable description of the criterion such as "HbA1c between 7.0% and 10.5%"
}