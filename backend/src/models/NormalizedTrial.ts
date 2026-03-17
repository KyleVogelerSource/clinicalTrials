export interface NormalizedTrial {
    nctId: string;
    briefTitle: string;

    phase: string;
    studyType: string;
    overallStatus: string;

    enrollmentCount: number;
    enrollmentType: "ACTUAL" | "ESTIMATED";

    startDate: string | null;
    completionDate: string | null;

    conditions: string[];
    interventions: string[];

    eligibilityCriteria: string;
    sex: string;
    minimumAge: string | null;
    maximumAge: string | null;

    primaryOutcomes: string[];

    sponsor: string | null;
}

export interface CandidatePool {
    trials: NormalizedTrial[];
    metadata: CandidatePoolMetadata;
}

export interface CandidatePoolMetadata {
    totalReturnedByApi: number;
    totalFiltered: number;
    totalInPool: number;
    cappedAt: number;
}