export interface TerminationReasonBar {
    reason: string;
    count: number;
}

export interface RecruitmentImpactBar {
    label: string;
    avgDays: number;
    participantCount: number;
}

export interface TimelineBar {
    patientBucket: string;
    estimatedDays: number;
    actualDays: number;
}

export interface TrialResultsResponse {
    overallScore: number;
    totalTrialsFound: number;
    queryCondition: string | null;
    terminationReasons: TerminationReasonBar[];
    avgRecruitmentDays: number;
    participantTarget: number;
    recruitmentByImpact: RecruitmentImpactBar[];
    timelineBuckets: TimelineBar[];
    generatedAt: string;
}
