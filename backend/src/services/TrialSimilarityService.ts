import { NormalizedTrial } from "../models/NormalizedTrial";

export interface ScoredTrial {
    trial: NormalizedTrial;
    similarityScore: number;
    rank: number;
}

export interface SimilarityRankingResult {
    rankedTrials: ScoredTrial[];
    proposedNctId: string | null;
    topK: number;
    totalCandidates: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
        return 0;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    if (magnitude === 0) return 0;

    return dot / magnitude;
}

export function rankBySimiliarity(proposedEmbedding: number[],candidateEmbeddings: Map<string, number[]>,candidateTrials: NormalizedTrial[], topK = 15, proposedNctId: string | null = null): SimilarityRankingResult {
    const trialMap = new Map<string, NormalizedTrial>(
        candidateTrials.map((t) => [t.nctId, t])
    );

    const scored: Array<{ nctId: string; score: number }> = [];

    for (const [nctId, embedding] of candidateEmbeddings.entries()) {
        const score = cosineSimilarity(proposedEmbedding, embedding);
        scored.push({ nctId, score });
    }

    scored.sort((a, b) => b.score - a.score);

    const topSlice = scored.slice(0, topK);

    const rankedTrials: ScoredTrial[] = topSlice
        .map((item, index) => {
            const trial = trialMap.get(item.nctId);
            if (!trial) return null;
            return {
                trial,
                similarityScore: Math.round(item.score * 10000) / 10000,
                rank: index + 1,
            };
        })
        .filter((item): item is ScoredTrial => item !== null);

    console.log(
        `[TrialSimilarityService] Ranked ${scored.length} candidates — returning top ${rankedTrials.length}`
    );

    return {
        rankedTrials,
        proposedNctId,
        topK,
        totalCandidates: scored.length,
    };
}