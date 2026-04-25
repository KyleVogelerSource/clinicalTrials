import { NormalizedTrial } from "../models/NormalizedTrial";
import { TrialMetricEntry } from "../dto/TrialResultsResponse";

function dateToMs(date: string | null): number | null {
    if (!date) return null;
    const parsed = new Date(`${date}-01`);
    return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function trialDurationDays(trial: NormalizedTrial): number | null {
    const start = dateToMs(trial.startDate);
    const end = dateToMs(trial.completionDate);
    if (start === null || end === null || end <= start) return null;
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

type MetricExtractor = (trial: NormalizedTrial) => string | number | null;

const METRICS: { key: string; extract: MetricExtractor }[] = [
    // Status & identification
    { key: "phase", extract: (t) => t.phase },
    { key: "studyType", extract: (t) => t.studyType },
    { key: "overallStatus", extract: (t) => t.overallStatus },
    { key: "hasResults", extract: (t) => t.hasResults ? "Yes" : "No" },
    { key: "whyStopped", extract: (t) => t.whyStopped },
    { key: "acronym", extract: (t) => t.acronym },

    // Enrollment
    { key: "enrollmentCount", extract: (t) => t.enrollmentCount > 0 ? t.enrollmentCount : null },
    { key: "enrollmentType", extract: (t) => t.enrollmentType },

    // Timeline
    { key: "startDate", extract: (t) => t.startDate },
    { key: "completionDate", extract: (t) => t.completionDate },
    { key: "durationDays", extract: (t) => trialDurationDays(t) },

    // Design
    { key: "allocation", extract: (t) => t.allocation },
    { key: "interventionModel", extract: (t) => t.interventionModel },
    { key: "primaryPurpose", extract: (t) => t.primaryPurpose },
    { key: "masking", extract: (t) => t.masking },
    { key: "whoMasked", extract: (t) => t.whoMasked.length > 0 ? t.whoMasked.join(", ") : null },
    { key: "armCount", extract: (t) => t.armCount > 0 ? t.armCount : null },

    // Arms & interventions
    { key: "interventionCount", extract: (t) => t.interventions.length },
    { key: "interventionTypes", extract: (t) => t.interventionTypes.length > 0 ? t.interventionTypes.join(", ") : null },
    { key: "interventions", extract: (t) => t.interventions.length > 0 ? t.interventions.join("; ") : null },

    // Eligibility
    { key: "sex", extract: (t) => t.sex },
    { key: "minimumAge", extract: (t) => t.minimumAge },
    { key: "maximumAge", extract: (t) => t.maximumAge },
    { key: "healthyVolunteers", extract: (t) => t.healthyVolunteers === null ? null : t.healthyVolunteers ? "Yes" : "No" },
    { key: "stdAges", extract: (t) => t.stdAges.length > 0 ? t.stdAges.join(", ") : null },

    // Outcomes
    { key: "primaryOutcomeCount", extract: (t) => t.primaryOutcomes.length },
    { key: "primaryOutcomes", extract: (t) => t.primaryOutcomes.length > 0 ? t.primaryOutcomes.join("; ") : null },
    { key: "secondaryOutcomeCount", extract: (t) => t.secondaryOutcomes.length },
    { key: "secondaryOutcomes", extract: (t) => t.secondaryOutcomes.length > 0 ? t.secondaryOutcomes.join("; ") : null },

    // Conditions
    { key: "conditions", extract: (t) => t.conditions.length > 0 ? t.conditions.join("; ") : null },
    { key: "meshTerms", extract: (t) => t.meshTerms.length > 0 ? t.meshTerms.join("; ") : null },

    // Sponsors & sites
    { key: "sponsor", extract: (t) => t.sponsor },
    { key: "sponsorClass", extract: (t) => t.sponsorClass },
    { key: "collaboratorCount", extract: (t) => t.collaboratorCount },
    { key: "locationCount", extract: (t) => t.locationCount > 0 ? t.locationCount : null },
    { key: "countries", extract: (t) => t.countries.length > 0 ? t.countries.join(", ") : null },

    // Oversight
    { key: "hasDmc", extract: (t) => t.hasDmc === null ? null : t.hasDmc ? "Yes" : "No" },
];

export function buildComparisonMetrics(trials: NormalizedTrial[]): TrialMetricEntry[] {
    const entries: TrialMetricEntry[] = [];

    for (const trial of trials) {
        for (const { key, extract } of METRICS) {
            entries.push({
                nctId: trial.nctId,
                briefTitle: trial.briefTitle,
                metric: key,
                value: extract(trial),
            });
        }
    }

    return entries;
}