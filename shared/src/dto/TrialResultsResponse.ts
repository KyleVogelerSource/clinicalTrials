export interface RecruitmentImpactBar {
    label: string;
    avgDays: number;
    participantCount: number;
    correlation?: number | null;
    impactText?: string | null;
}

export interface TimelineBar {
    patientBucket: string;
    estimatedDays: number;
    actualDays: number;
}

export interface TrialResultsResponse {
    timestamp: Date;
    overallScore: number;
    overallSummary: string | null;
    totalTrialsFound: number;
    queryCondition: string | null;
    avgRecruitmentDays: number;
    participantTarget: number;
    recruitmentByImpact: RecruitmentImpactBar[];
    timelineBuckets: TimelineBar[];
    
    // Sibling-adjusted timeline fields
    timelineRange?: string;
    siblingCount?: number;

    explanation?: {
        explanation: string;
        generatedAt: string;
    };

    // OBSOLETE
    terminationReasons: TerminationReasonBar[];
    generatedAt: string;
}

// OBSOLETE
export interface TerminationReasonBar {
    reason: string;
    count: number;
}

// How commonly a single proposed criterion appears across the historical pool, and which trials explicitly contain it.
export interface CriterionMatch {
    description: string;
    conceptId?: string | null;
    poolMatchPct: number;
    matchingTrialIds: string[];
}

export interface EligibilityCriteriaComparison {
    inclusion: CriterionMatch[];
    exclusion: CriterionMatch[];
}

// A single metric measurement for one trial.
export interface TrialMetricEntry {
    nctId: string;
    briefTitle: string;
    metric: string; // Metric key such as enrollmentCount, phase, durationDays
    value: string | number | null;
}