import { NormalizedTrial } from "../models/NormalizedTrial";
import { EligibilityCriterion } from "../dto/TrialResultsRequest";
import { CriterionMatch, EligibilityCriteriaComparison } from "../dto/TrialResultsResponse";

const NORMALIZE_RE = /[\s\-_/]+/g;

function normalizeText(text: string): string {
    return text.toLowerCase().replace(NORMALIZE_RE, " ").trim();
}

const STOP_WORDS = new Set([
    "the", "and", "for", "with", "that", "this", "are", "has", "have",
    "been", "not", "from", "was", "were", "will", "than", "more", "less",
    "per", "any", "all", "who", "use", "used", "using", "must", "may",
    "should", "able", "due", "each", "such",
]);

function tokenize(text: string): string[] {
    return normalizeText(text)
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function criterionMatchesTrial(criterion: EligibilityCriterion, trial: NormalizedTrial): boolean {
    if (!trial.eligibilityCriteria) return false;

    const haystack = normalizeText(trial.eligibilityCriteria);
    const tokens = tokenize(criterion.description);

    if (tokens.length === 0) return false;

    return tokens.every((token) => haystack.includes(token));
}

function matchCriteria(criteria: EligibilityCriterion[], pool: NormalizedTrial[]): CriterionMatch[] {
    if (pool.length === 0 || criteria.length === 0) return [];

    return criteria.map((criterion) => {
        const matchingTrials = pool.filter((trial) =>
            criterionMatchesTrial(criterion, trial)
        );

        return {
            description: criterion.description,
            conceptId: criterion.conceptId ?? null,
            poolMatchPct:
                pool.length > 0
                    ? Math.round((matchingTrials.length / pool.length) * 100)
                    : 0,
            matchingTrialIds: matchingTrials.map((t) => t.nctId),
        };
    });
}

export function matchEligibilityCriteria(inclusionCriteria: EligibilityCriterion[], exclusionCriteria: EligibilityCriterion[], pool: NormalizedTrial[]): EligibilityCriteriaComparison {
    return {
        inclusion: matchCriteria(inclusionCriteria, pool),
        exclusion: matchCriteria(exclusionCriteria, pool),
    };
}