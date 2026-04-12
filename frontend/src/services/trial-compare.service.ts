import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../app/config/api.config';

export interface TrialCompareWeights {
  conditionOverlap?: number;
  phaseMatch?: number;
  studyType?: number;
  eligibilityCompatibility?: number;
  interventionOverlap?: number;
  enrollmentSimilarity?: number;
  statusRecency?: number;
}

export interface TrialCompareRequest {
  trials: { nctId: string }[];
  weights?: TrialCompareWeights;
}

export interface NormalizedTrialSummary {
  nctId: string;
  briefTitle: string;
  phase: string;
  studyType: string;
  overallStatus: string;
  enrollmentCount: number;
  conditions: string[];
  interventions: string[];
  sex: string;
  minimumAge: string | null;
  maximumAge: string | null;
  sponsor: string | null;
  startDate: string | null;
  completionDate: string | null;
}

export interface TrialComparisonCell {
  againstNctId: string;
  score: number;
  weightedBreakdown: Required<TrialCompareWeights>;
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

export interface TrialCompareResponse {
  normalizedTrials: NormalizedTrialSummary[];
  comparisonMatrix: TrialComparisonRow[];
  benchmarkScores: TrialBenchmarkScore[];
}

@Injectable({ providedIn: 'root' })
export class TrialCompareService {
  constructor(private http: HttpClient) {}

  compareTrials(request: TrialCompareRequest): Observable<TrialCompareResponse> {
    return this.http.post<TrialCompareResponse>(apiUrl('/api/clinical-trials/compare'), request);
  }
}
