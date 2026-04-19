import { NormalizedTrial } from "../models/NormalizedTrial";

export interface OutlierThresholds {
    lowerPercentile: number;
    upperPercentile: number;
    /** Minimum pool size before outlier flags are reported. Below this threshold
     *  percentile estimates are too noisy to be meaningful. */
    minPoolSize: number;
}

export type OutlierDirection = "HIGH" | "LOW" | "NORMAL";

export interface NumericBenchmark {
    attribute: string;
    proposedValue: number | null;
    poolMin: number;
    poolMax: number;
    poolMedian: number;
    poolMean: number;
    poolP25: number;
    poolP75: number;
    proposedPercentile: number | null;
    outlier: OutlierDirection;
    /** True when the pool was too small to produce reliable percentile estimates. */
    insufficientData: boolean;
}

export interface CategoricalBenchmark {
    attribute: string;
    proposedValue: string;
    poolFrequency: Record<string, number>;
    proposedFrequencyPct: number;
    uncommon: boolean;
    insufficientData: boolean;
}

export interface OutlierDetectionResult {
    numeric: NumericBenchmark[];
    categorical: CategoricalBenchmark[];
    thresholds: OutlierThresholds;
    poolSize: number;
}

const DEFAULT_THRESHOLDS: OutlierThresholds = {
    lowerPercentile: 10,
    upperPercentile: 90,
    minPoolSize: 10,
};

function sortedNumbers(values: number[]): number[] {
    return [...values].sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;

    return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percentileRank(sorted: number[], proposedValue: number): number {
    if (sorted.length === 0) return 50;

    let below = 0;
    let equal = 0;

    for (const v of sorted) {
        if (v < proposedValue) below++;
        else if (v === proposedValue) equal++;
    }

    return Math.round(((below + 0.5 * equal) / sorted.length) * 100);
}

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

function buildNumericBenchmark(
    attribute: string,
    proposedValue: number | null,
    poolValues: number[],
    thresholds: OutlierThresholds
): NumericBenchmark {
    const sorted = sortedNumbers(poolValues);
    const insufficientData = sorted.length < thresholds.minPoolSize;

    const proposedPercentile =
        proposedValue !== null && sorted.length > 0
            ? percentileRank(sorted, proposedValue)
            : null;

    // Only flag outliers when we have enough data to trust the percentile estimate
    let outlier: OutlierDirection = "NORMAL";
    if (!insufficientData && proposedPercentile !== null) {
        if (proposedPercentile >= thresholds.upperPercentile) outlier = "HIGH";
        else if (proposedPercentile <= thresholds.lowerPercentile) outlier = "LOW";
    }

    return {
        attribute,
        proposedValue,
        poolMin: sorted[0] ?? 0,
        poolMax: sorted[sorted.length - 1] ?? 0,
        poolMedian: percentile(sorted, 50),
        poolMean: Math.round(mean(sorted)),
        poolP25: percentile(sorted, 25),
        poolP75: percentile(sorted, 75),
        proposedPercentile,
        outlier,
        insufficientData,
    };
}

function buildCategoricalBenchmark(
    attribute: string,
    proposedValue: string,
    poolValues: string[],
    thresholds: OutlierThresholds
): CategoricalBenchmark {
    const insufficientData = poolValues.length < thresholds.minPoolSize;

    const freq: Record<string, number> = {};
    for (const v of poolValues) {
        freq[v] = (freq[v] ?? 0) + 1;
    }

    const proposedCount = freq[proposedValue] ?? 0;
    const proposedFrequencyPct =
        poolValues.length > 0
            ? Math.round((proposedCount / poolValues.length) * 100)
            : 0;

    return {
        attribute,
        proposedValue,
        poolFrequency: freq,
        proposedFrequencyPct,
        // Only flag as uncommon when we have enough data to be confident
        uncommon: !insufficientData && proposedFrequencyPct < 20,
        insufficientData,
    };
}

export function detectOutliers(
    rankedPool: NormalizedTrial[],
    proposedValues: {
        enrollmentCount?: number | null;
        phase?: string;
        studyType?: string;
        sex?: string;
        startDate?: string | null;
        completionDate?: string | null;
    },
    thresholds: OutlierThresholds = DEFAULT_THRESHOLDS
): OutlierDetectionResult {
    const poolEnrollments = rankedPool.map((t) => t.enrollmentCount).filter((n) => n > 0);
    const enrollmentBenchmark = buildNumericBenchmark(
        "enrollmentCount",
        proposedValues.enrollmentCount ?? null,
        poolEnrollments,
        thresholds
    );

    const poolDurations = rankedPool
        .map(trialDurationDays)
        .filter((d): d is number => d !== null);

    const proposedDuration: number | null = (() => {
        const start = dateToMs(proposedValues.startDate ?? null);
        const end = dateToMs(proposedValues.completionDate ?? null);
        if (start !== null && end !== null && end > start) {
            return Math.round((end - start) / (1000 * 60 * 60 * 24));
        }
        return null;
    })();

    const durationBenchmark = buildNumericBenchmark(
        "durationDays",
        proposedDuration,
        poolDurations,
        thresholds
    );

    const poolPhases = rankedPool.map((t) => t.phase);
    const phaseBenchmark = buildCategoricalBenchmark(
        "phase",
        proposedValues.phase ?? "UNKNOWN",
        poolPhases,
        thresholds
    );

    const poolStudyTypes = rankedPool.map((t) => t.studyType);
    const studyTypeBenchmark = buildCategoricalBenchmark(
        "studyType",
        proposedValues.studyType ?? "UNKNOWN",
        poolStudyTypes,
        thresholds
    );

    const poolSex = rankedPool.map((t) => t.sex);
    const sexBenchmark = buildCategoricalBenchmark(
        "sex",
        proposedValues.sex ?? "ALL",
        poolSex,
        thresholds
    );

    return {
        numeric: [enrollmentBenchmark, durationBenchmark],
        categorical: [phaseBenchmark, studyTypeBenchmark, sexBenchmark],
        thresholds,
        poolSize: rankedPool.length,
    };
}