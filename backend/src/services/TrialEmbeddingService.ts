const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";
const BATCH_SIZE = 128;

export interface TrialEmbedding {
    nctId: string;
    embedding: number[];
}

export interface EmbeddingBatchResult {
    embeddings: TrialEmbedding[];
    totalInputTokens: number;
}

async function voyageEmbedBatch(inputs: Array<{ nctId: string; text: string }>,apiKey: string): Promise<TrialEmbedding[]> {
    const texts = inputs.map((i) => i.text);

    const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: VOYAGE_MODEL,
            input: texts,
            input_type: "document",
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Voyage embedding error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
        data: Array<{ index: number; embedding: number[] }>;
    };

    const sorted = [...data.data].sort((a, b) => a.index - b.index);

    return sorted.map((item, i) => ({
        nctId: inputs[i].nctId,
        embedding: item.embedding,
    }));
}

export async function generateEmbeddings(synopses: Array<{ nctId: string; synopsis: string }>,apiKey: string): Promise<EmbeddingBatchResult> {
    const allEmbeddings: TrialEmbedding[] = [];
    const failed: string[] = [];

    for (let i = 0; i < synopses.length; i += BATCH_SIZE) {
        const batch = synopses.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        console.log(
            `[TrialEmbeddingService] Embedding batch ${batchNum} — ${batch.length} texts`
        );

        try {
            const inputs = batch.map((s) => ({ nctId: s.nctId, text: s.synopsis }));
            const results = await voyageEmbedBatch(inputs, apiKey);
            allEmbeddings.push(...results);
        } catch (err) {
            console.error(`[TrialEmbeddingService] Batch ${batchNum} failed:`, err);
            // Fall back: push zero-vectors so the pipeline can continue
            for (const s of batch) {
                failed.push(s.nctId);
                console.warn(`[TrialEmbeddingService] Using zero-vector fallback for ${s.nctId}`);
                allEmbeddings.push({ nctId: s.nctId, embedding: [] });
            }
        }
    }
    const dim = allEmbeddings.find((e) => e.embedding.length > 0)?.embedding.length ?? 1024;

    for (const e of allEmbeddings) {
        if (e.embedding.length === 0) {
            e.embedding = Array(dim).fill(0);
        }
    }

    if (failed.length > 0) {
        console.warn(
            `[TrialEmbeddingService] ${failed.length} trials used zero-vector fallback: ${failed.join(", ")}`
        );
    }

    return {
        embeddings: allEmbeddings,
        totalInputTokens: 0,
    };
}