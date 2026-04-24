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

//How commonly a single proposed criterion appears across the historical pool, and which trials explicitly contain it.
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

//A single metric measurement for one trial.
export interface TrialMetricEntry {
  nctId: string;
  briefTitle: string;
  metric: string; // enrollmentCount, phase, etc.
  value: string | number | null;
}