import { NormalizedTrial } from "../models/NormalizedTrial";

const MAX_DESCRIPTION_CHARS = 2000;

export interface SynopsisResult {
    nctId: string;
    synopsis: string;
}

export function generateSynopsis(trial: NormalizedTrial): SynopsisResult {
    const parts: string[] = [];

    if (trial.briefTitle) {
        parts.push(`Title: ${trial.briefTitle}`);
    }

    if (trial.conditions.length > 0) {
        parts.push(`Condition(s): ${trial.conditions.join(", ")}`);
    }

    if (trial.interventions.length > 0) {
        parts.push(`Intervention(s): ${trial.interventions.join(", ")}`);
    }

    const phaseStudy = [
        trial.phase !== "NA" && trial.phase !== "UNKNOWN" ? `Phase: ${trial.phase}` : null,
        trial.studyType !== "UNKNOWN" ? `Study Type: ${trial.studyType}` : null,
    ]
        .filter(Boolean)
        .join(" | ");

    if (phaseStudy) {
        parts.push(phaseStudy);
    }

    if (trial.primaryOutcomes.length > 0) {
        parts.push(`Primary Outcome(s): ${trial.primaryOutcomes.slice(0, 3).join("; ")}`);
    }

    if (trial.eligibilityCriteria) {
        const truncated = trial.eligibilityCriteria.slice(0, MAX_DESCRIPTION_CHARS);
        const wasTruncated = trial.eligibilityCriteria.length > MAX_DESCRIPTION_CHARS;
        parts.push(`Eligibility: ${truncated}${wasTruncated ? "..." : ""}`);
    }

    return {
        nctId: trial.nctId,
        synopsis: parts.join("\n"),
    };
}

export function generateSynopses(trials: NormalizedTrial[]): SynopsisResult[] {
    return trials.map(generateSynopsis);
}