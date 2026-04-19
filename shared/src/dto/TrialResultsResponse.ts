export interface RecruitmentImpactBar {
    label: string;
    avgDays: number;
    participantCount: number;
    correlation?: number;
    impactText?: string;
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

    // OBSELETE
    terminationReasons: TerminationReasonBar[];
    generatedAt: string;
}

// OBSELETE
export interface TerminationReasonBar {
    reason: string;
    count: number;
}
