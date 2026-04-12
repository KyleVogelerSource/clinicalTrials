import { NormalizedTrial } from "../models/NormalizedTrial";

export interface TrialCompareWeights {
  conditionOverlap: number;
  phaseMatch: number;
  studyType: number;
  eligibilityCompatibility: number;
  interventionOverlap: number;
  enrollmentSimilarity: number;
  statusRecency: number;
}

export interface TrialCompareInput {
  nctId: string;
}

export interface TrialComparisonCell {
  againstNctId: string;
  score: number;
  weightedBreakdown: TrialCompareWeights;
  explanations: string[];
}

export interface TrialComparisonRow {
  nctId: string;
  scores: TrialComparisonCell[];
}

export interface TrialBenchmarkScore {
  nctId: string;
  score: number;
  rank: number;
}

export interface TrialCompareRequest {
  trials: TrialCompareInput[];
  weights?: Partial<TrialCompareWeights>;
}

export interface TrialCompareResponse {
  normalizedTrials: NormalizedTrial[];
  comparisonMatrix: TrialComparisonRow[];
  benchmarkScores: TrialBenchmarkScore[];
}
