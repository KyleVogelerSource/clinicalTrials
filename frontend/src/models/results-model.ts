import { TrialResultsResponse } from "@shared/dto/TrialResultsResponse";

export interface LabelBar {
    reason: string;
    count: number;
}

export const metricNames: string[] = [
    "Total Enrollment",
    "Site Count",
    "Recruitment Velocity",
    "Inclusion Strictnes",
    "Site Efficiency",
    "Outcome Density",
    "Age Span",
    "Min Age",
    "Max Age",
    "Intervention Count",
    "Collaborator Count",
    "Timeline Slippage",
    "Masking Intensity",
    "Geographic Spread",
    "Condition Count"
];

export interface MetricRow {
    id: string;
    totalEnrollment: number;
    siteCount: number;
    recruitmentVelocity: number;
    inclusionStrictness: number; // Eligibility criteria count
    siteEfficiency: number;
    outcomeDensity: number;
    ageSpan: number;
    minAge: number;
    maxAge: number;
    interventionCount: number;
    collaboratorCount: number;
    timelineSlippage: number;
    maskingIntensity: number;
    geographicSpread: number;
    conditionCount: number;
}

export interface BenchmarkInfo {
    name : string; 
    appearances: number;
}

// TODO: Geo locations

export class ResultsModel {
    trialResults?: TrialResultsResponse;
    terminationReasons: LabelBar[] = [];
    metricNames: string[] = metricNames;
    metricRows: MetricRow[] = [];
    complitionBenchmarks: BenchmarkInfo[] = [];
    terminationBenchmarks: BenchmarkInfo[] = [];
}