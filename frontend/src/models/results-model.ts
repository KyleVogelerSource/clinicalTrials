import { TrialResultsResponse } from "@shared/dto/TrialResultsResponse";
import { HeatPoint } from "../primitives/heatmap/heatmap";

export interface LabelBar {
    reason: string;
    count: number;
}

export const metricNames: string[] = [
    "Total Enrollment",
    "Site Count",
    "Recruitment Velocity",
    "Inclusion Strictness",
    "Site Efficiency",
    "Outcome Density",
    "Age Span",
    "Min Age",
    "Max Age",
    "Intervention Count",
    "Collaborator Count",
    "Duration (Days)",
    "Masking Intensity",
    "Condition Count",
    "Arm Count"
];

export class MetricRow {
    id: string = '';
    totalEnrollment: number = 0;
    siteCount: number = 0;
    recruitmentVelocity: number = 0;
    inclusionStrictness: number = 0; // aka Eligibility criteria count
    exclusionStrictness: number = 0;
    siteEfficiency: number = 0;
    outcomeDensity: number = 0;
    ageSpan: number = 0;
    minAge: number = 0;
    maxAge: number = 0;
    interventionCount: number = 0;
    collaboratorCount: number = 0;
    duration: number = 0;
    maskingIntensity: number = 0;
    conditionCount: number = 0;
    armCount: number = 0;

    // TODO: Should probably keep these nullable and later filter out points where x or y are null
    static metricExtractors: Record<string, (r:MetricRow) => number | null> = {
        "Total Enrollment": (r) => r.totalEnrollment,
        "Site Count": (r) => r.siteCount,
        "Recruitment Velocity": (r) => r.recruitmentVelocity,
        "Inclusion Strictness": (r) => r.inclusionStrictness,
        "Exclusion Strictness": (r) => r.exclusionStrictness,
        "Site Efficiency": (r) => r.siteEfficiency,
        "Outcome Density": (r) => r.outcomeDensity,
        "Age Span": (r) => r.ageSpan,
        "Min Age": (r) => r.minAge,
        "Max Age": (r) => r.maxAge,
        "Intervention Count": (r) => r.interventionCount,
        "Collaborator Count": (r) => r.collaboratorCount,
        "Duration (Days)": (r) => r.duration,
        "Masking Intensity": (r) => r.maskingIntensity,
        "Condition Count": (r) => r.conditionCount,
        "Arm Count": (r) => r.armCount,
    };
}

export interface BenchmarkInfo {
    name : string; 
    appearances: number;
}

export interface TopSite {
    name: string;
    count: number;
    coords: [number, number] | null;
}

// TODO: Geo locations

export class ResultsModel {
    trialResults?: TrialResultsResponse;
    terminationReasons: LabelBar[] = [];
    siteLocations: HeatPoint[] = [];
    topSites: TopSite[] = [];
    metricNames: string[] = metricNames;
    metricRows: MetricRow[] = [];
    complitionBenchmarks: BenchmarkInfo[] = [];
    terminationBenchmarks: BenchmarkInfo[] = [];
}