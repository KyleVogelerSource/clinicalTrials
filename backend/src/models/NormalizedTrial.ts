export interface NormalizedTrial {
    nctId: string;
    briefTitle: string;
    officialTitle: string | null;
    acronym: string | null;

    phase: string;
    studyType: string;
    overallStatus: string;
    whyStopped: string | null;
    hasResults: boolean;

    enrollmentCount: number;
    enrollmentType: "ACTUAL" | "ESTIMATED";

    startDate: string | null;
    completionDate: string | null;

    allocation: string | null;
    interventionModel: string | null;
    primaryPurpose: string | null;
    masking: string | null;
    whoMasked: string[];

    conditions: string[];
    interventions: string[];
    interventionTypes: string[];
    armCount: number;

    eligibilityCriteria: string;
    sex: string;
    minimumAge: string | null;
    maximumAge: string | null;
    healthyVolunteers: boolean | null;
    stdAges: string[];

    primaryOutcomes: string[];
    secondaryOutcomes: string[];

    sponsor: string | null;
    sponsorClass: string | null;
    collaboratorCount: number;
    locationCount: number;
    countries: string[];

    hasDmc: boolean | null;
    meshTerms: string[];
}

export interface ReferenceTrial {
    phase?: string;
    studyType?: string;
    sex?: string;
    conditions?: string[];
    enrollmentCount?: number;
}

export type FilterReason =
    | "missing_phase"
    | "missing_enrollment"
    | "missing_eligibility_criteria"
    | "phase_mismatch"
    | "study_type_mismatch"
    | "sex_incompatible"
    | "no_condition_overlap"
    | "required_condition_not_met"
    | "ineligible_condition_present";

export type ExclusionReason = "capped";

export interface FilteredRecord {
    nctId: string;
    briefTitle: string;
    reason: FilterReason;
    detail?: string;
}

export interface ExcludedRecord {
    nctId: string;
    briefTitle: string;
    reason: ExclusionReason;
    rank: number;
    enrollmentCount: number;
    startDate: string | null;
}

export interface CandidatePoolMetadata {
    totalFetchedFromApi: number;
    totalPagesfetched: number;
    totalFiltered: number;
    totalExcluded: number;
    totalInPool: number;
    cappedAt: number;
}

export interface CandidatePool {
    trials: NormalizedTrial[];
    metadata: CandidatePoolMetadata;
}

export interface CandidatePoolInternal extends CandidatePool {
    filtered: FilteredRecord[];
    excluded: ExcludedRecord[];
}