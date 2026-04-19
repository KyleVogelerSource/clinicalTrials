import { OutlierDetectionResult, NumericBenchmark, CategoricalBenchmark } from "./TrialOutlierDetector";
import { ScoredTrial } from "./TrialSimilarityService";
import { TrialResultsRequest } from "../dto/TrialResultsRequest";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export interface ExplanationResult {
    explanation: string;
    generatedAt: string;
}

function formatNumericBenchmark(b: NumericBenchmark): string {
    const lines: string[] = [
        `Attribute: ${b.attribute}`,
        `  Proposed value: ${b.proposedValue ?? "not specified"}`,
        `  Pool median: ${b.poolMedian} | Mean: ${b.poolMean} | P25: ${b.poolP25} | P75: ${b.poolP75}`,
        `  Proposed percentile: ${b.insufficientData ? "N/A (insufficient pool data)" : (b.proposedPercentile ?? "N/A")}`,
        `  Outlier flag: ${b.insufficientData ? "SUPPRESSED (pool too small)" : b.outlier}`,
    ];
    return lines.join("\n");
}

function formatCategoricalBenchmark(b: CategoricalBenchmark): string {
    const freqStr = Object.entries(b.poolFrequency)
        .sort(([, a], [, bv]) => bv - a)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

    return [
        `Attribute: ${b.attribute}`,
        `  Proposed value: ${b.proposedValue}`,
        `  Pool frequency: ${freqStr}`,
        `  Proposed value appears in ${b.proposedFrequencyPct}% of pool trials`,
        `  Uncommon: ${b.insufficientData ? "N/A (pool too small)" : b.uncommon}`,
    ].join("\n");
}

function buildExplanationPrompt(
    request: TrialResultsRequest,
    topTrials: ScoredTrial[],
    outliers: OutlierDetectionResult
): string {
    const topTrialSummaries = topTrials.slice(0, 5).map((st, i) =>
        `  ${i + 1}. ${st.trial.briefTitle} (${st.trial.nctId}) — similarity: ${st.similarityScore}, status: ${st.trial.overallStatus}, enrollment: ${st.trial.enrollmentCount}`
    ).join("\n");

    const numericSections = outliers.numeric.map(formatNumericBenchmark).join("\n\n");
    const categoricalSections = outliers.categorical.map(formatCategoricalBenchmark).join("\n\n");

    const outlierFlags = [
        ...outliers.numeric
            .filter((b) => b.outlier !== "NORMAL" && !b.insufficientData)
            .map((b) => `${b.attribute} is ${b.outlier} (${b.proposedPercentile}th percentile)`),
        ...outliers.categorical
            .filter((b) => b.uncommon && !b.insufficientData)
            .map((b) => `${b.attribute} "${b.proposedValue}" is uncommon in similar trials (${b.proposedFrequencyPct}%)`),
    ];

    const poolSizeNote =
        outliers.poolSize < outliers.thresholds.minPoolSize
            ? `\nNOTE: The pool contains only ${outliers.poolSize} trials (minimum recommended: ${outliers.thresholds.minPoolSize}). Statistical outlier flags have been suppressed. Interpret benchmark values with caution.`
            : "";

    return `PROPOSED TRIAL DESIGN:
- Condition: ${request.condition ?? "not specified"}
- Phase: ${request.phase ?? "not specified"}
- Intervention model: ${request.interventionModel ?? "not specified"}
- Allocation: ${request.allocationType ?? "not specified"}
- Sex: ${request.sex ?? "not specified"}
- Age range: ${request.minAge ?? "any"} to ${request.maxAge ?? "any"}
${poolSizeNote}
TOP SIMILAR HISTORICAL TRIALS (by cosine similarity):
${topTrialSummaries}

NUMERIC BENCHMARKS (computed from ${outliers.poolSize} similar trials):
${numericSections}

CATEGORICAL BENCHMARKS:
${categoricalSections}

OUTLIER FLAGS:
${outlierFlags.length > 0 ? outlierFlags.map((f) => `- ${f}`).join("\n") : "No outliers detected."}

Write a 3–4 paragraph plain-language explanation of these findings for a clinical operations professional.
- Paragraph 1: Briefly describe what similar trials look like based on the top matches.
- Paragraph 2: Discuss how the proposed trial's enrollment compares to historical norms, citing the specific percentile and median values above.
- Paragraph 3: Address any outlier flags. If none, say the design appears typical for this trial type.
- Paragraph 4 (optional): Note any categorical attributes that are uncommon in similar trials.

Use only the statistics provided. Do not invent numbers. Write in plain English without bullet points or headers.`;
}

const SYSTEM_PROMPT =
    "You are a clinical operations analyst summarizing a trial benchmarking report. " +
    "You write clear, accurate, plain-language summaries grounded exclusively in the statistics provided. " +
    "You never invent numbers, percentiles, or trial details not present in the prompt.";

export async function generateExplanation(
    request: TrialResultsRequest,
    topTrials: ScoredTrial[],
    outliers: OutlierDetectionResult,
    apiKey: string
): Promise<ExplanationResult> {
    // Server-authoritative timestamp — never rely on the model to generate this
    const generatedAt = new Date().toISOString();

    if (topTrials.length === 0) {
        return {
            explanation:
                "No similar historical trials were found for the proposed design. Consider broadening the search parameters.",
            generatedAt,
        };
    }

    const userPrompt = buildExplanationPrompt(request, topTrials, outliers);

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
    };

    const explanation = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

    return { explanation, generatedAt };
}