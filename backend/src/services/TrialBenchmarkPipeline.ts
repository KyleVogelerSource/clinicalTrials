import { NormalizedTrial } from "../models/NormalizedTrial";
import { generateSynopsis, generateSynopses } from "./TrialSynopsisGenerator";
import { generateEmbeddings, TrialEmbedding } from "./TrialEmbeddingService";
import { rankBySimiliarity, SimilarityRankingResult } from "./TrialSimilarityService";
import { detectOutliers, OutlierDetectionResult } from "./TrialOutlierDetector";
import { generateExplanation, ExplanationResult } from "./TrialExplanationService";
import { matchEligibilityCriteria } from "./TrialEligibilityMatcher";
import { buildComparisonMetrics } from "./TrialComparisonMetrics";
import { TrialResultsRequest } from "../dto/TrialResultsRequest";
import { EligibilityCriteriaComparison, TrialMetricEntry } from "../dto/TrialResultsResponse";

export interface BenchmarkPipelineResult extends SimilarityRankingResult {
    outliers: OutlierDetectionResult;
    explanation: ExplanationResult;
    eligibilityComparison: EligibilityCriteriaComparison;
    comparisonMetrics: TrialMetricEntry[];
    pipelineSteps: {
        synopsesGenerated: number;
        embeddingsGenerated: number;
        embeddingCacheHits: number;
        totalInputTokens: number;
    };
}

// In-memory embedding cache keyed by NCT ID.
const embeddingCache = new Map<string, number[]>();

function getCachedEmbeddings(nctIds: string[]): {
    hits: TrialEmbedding[];
    misses: string[];
} {
    const hits: TrialEmbedding[] = [];
    const misses: string[] = [];

    for (const id of nctIds) {
        const cached = embeddingCache.get(id);
        if (cached) {
            hits.push({ nctId: id, embedding: cached });
        } else {
            misses.push(id);
        }
    }

    return { hits, misses };
}

function storeEmbeddingsInCache(embeddings: TrialEmbedding[]): void {
    for (const e of embeddings) {
        if (e.nctId !== "__proposed__") {
            embeddingCache.set(e.nctId, e.embedding);
        }
    }
}

function buildProposedSynopsisFromRequest(request: TrialResultsRequest): string {
    const parts: string[] = [];

    if (request.condition) {
        parts.push(`Condition(s): ${request.condition}`);
    }

    if (request.phase) {
        parts.push(`Phase: ${request.phase}`);
    }

    if (request.interventionModel) {
        parts.push(`Intervention Model: ${request.interventionModel}`);
    }

    if (request.allocationType) {
        parts.push(`Allocation: ${request.allocationType}`);
    }

    if (request.sex) {
        parts.push(`Sex: ${request.sex}`);
    }

    const ageRange = [
        request.minAge != null ? `min ${request.minAge}` : null,
        request.maxAge != null ? `max ${request.maxAge}` : null,
    ]
        .filter(Boolean)
        .join(", ");

    if (ageRange) {
        parts.push(`Age Range: ${ageRange}`);
    }

    return parts.join("\n");
}

export async function runBenchmarkPipeline(request: TrialResultsRequest, candidatePool: NormalizedTrial[], proposedTrial: NormalizedTrial | null = null, topK = 15, anthropicApiKey: string, voyageApiKey: string): Promise<BenchmarkPipelineResult> {
    const emptyOutliers = detectOutliers([], {});

    if (candidatePool.length === 0) {
        return {
            rankedTrials: [],
            proposedNctId: proposedTrial?.nctId ?? null,
            topK,
            totalCandidates: 0,
            outliers: emptyOutliers,
            explanation: {
                explanation:
                    "No similar historical trials were found for the proposed design. Consider broadening the search parameters.",
                generatedAt: new Date().toISOString(),
            },
            eligibilityComparison: { inclusion: [], exclusion: [] },
            comparisonMetrics: [],
            pipelineSteps: {
                synopsesGenerated: 0,
                embeddingsGenerated: 0,
                embeddingCacheHits: 0,
                totalInputTokens: 0,
            },
        };
    }

    const candidateSynopses = generateSynopses(candidatePool);

    const proposedSynopsisText = proposedTrial
        ? generateSynopsis(proposedTrial).synopsis
        : buildProposedSynopsisFromRequest(request);

    const proposedNctId = proposedTrial?.nctId ?? "__proposed__";

    const candidateNctIds = candidateSynopses.map((s) => s.nctId);
    const { hits: cachedEmbeddings, misses: missedNctIds } = getCachedEmbeddings(candidateNctIds);

    console.log(
        `[TrialBenchmarkPipeline] Cache: ${cachedEmbeddings.length} hits, ${missedNctIds.length} misses`
    );

    const synopsesToEmbed: Array<{ nctId: string; synopsis: string }> = [
        { nctId: proposedNctId, synopsis: proposedSynopsisText },
    ];

    for (const s of candidateSynopses) {
        if (missedNctIds.includes(s.nctId)) {
            synopsesToEmbed.push(s);
        }
    }

    const { embeddings: freshEmbeddings, totalInputTokens } = await generateEmbeddings(
        synopsesToEmbed,
        voyageApiKey
    );

    storeEmbeddingsInCache(freshEmbeddings);

    const allEmbeddings: TrialEmbedding[] = [...cachedEmbeddings, ...freshEmbeddings];

    const proposedEmbeddingRecord = allEmbeddings.find((e) => e.nctId === proposedNctId);
    if (!proposedEmbeddingRecord) {
        throw new Error("[TrialBenchmarkPipeline] Failed to generate embedding for proposed trial");
    }

    const candidateEmbeddingMap = new Map<string, number[]>(
        allEmbeddings
            .filter((e) => e.nctId !== proposedNctId)
            .map((e) => [e.nctId, e.embedding])
    );

    const rankingResult = rankBySimiliarity(
        proposedEmbeddingRecord.embedding,
        candidateEmbeddingMap,
        candidatePool,
        topK,
        proposedTrial?.nctId ?? null
    );

    const outliers = detectOutliers(
        rankingResult.rankedTrials.map((st) => st.trial),
        {
            enrollmentCount: proposedTrial?.enrollmentCount ?? null,
            phase: request.phase ?? proposedTrial?.phase,
            studyType: proposedTrial?.studyType,
            sex: request.sex ?? proposedTrial?.sex,
            startDate: proposedTrial?.startDate,
            completionDate: proposedTrial?.completionDate,
        }
    );

    const explanation = await generateExplanation(
        request,
        rankingResult.rankedTrials,
        outliers,
        anthropicApiKey
    );

    const rankedTrials = rankingResult.rankedTrials.map((st) => st.trial);

    const eligibilityComparison = matchEligibilityCriteria(
        request.inclusionCriteria ?? [],
        request.exclusionCriteria ?? [],
        rankedTrials
    );

    const comparisonMetrics = buildComparisonMetrics(rankedTrials);

    return {
        ...rankingResult,
        outliers,
        explanation,
        eligibilityComparison,
        comparisonMetrics,
        pipelineSteps: {
            synopsesGenerated: candidateSynopses.length,
            embeddingsGenerated: freshEmbeddings.length,
            embeddingCacheHits: cachedEmbeddings.length,
            totalInputTokens,
        },
    };
}