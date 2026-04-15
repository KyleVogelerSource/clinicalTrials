const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const EMBEDDING_DIM = 128;
const BATCH_SIZE = 10;

export interface TrialEmbedding {
    nctId: string;
    embedding: number[];
}

export interface EmbeddingBatchResult {
    embeddings: TrialEmbedding[];
    totalInputTokens: number;
}

async function claudeEmbedOne(text: string, apiKey: string): Promise<number[]> {
    const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 1024,
            system: `You are a text embedding engine. Given input text, return a JSON array of exactly ${EMBEDDING_DIM} floats between -1 and 1 representing the semantic content. Return ONLY the JSON array. No explanation, no markdown, no backticks.`,
            messages: [
                {
                    role: "user",
                    content: `Embed this clinical trial synopsis:\n\n${text.slice(0, 1500)}`,
                },
            ],
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude embedding error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
    };

    const raw = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

    const parsed = JSON.parse(raw) as number[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`Claude returned invalid embedding: ${raw.substring(0, 100)}`);
    }

    if (parsed.length > EMBEDDING_DIM) return parsed.slice(0, EMBEDDING_DIM);
    if (parsed.length < EMBEDDING_DIM) return [...parsed, ...Array(EMBEDDING_DIM - parsed.length).fill(0)];
    return parsed;
}

export async function generateEmbeddings(synopses: Array<{ nctId: string; synopsis: string }>, apiKey: string): Promise<EmbeddingBatchResult> {
    const allEmbeddings: TrialEmbedding[] = [];

    for (let i = 0; i < synopses.length; i += BATCH_SIZE) {
        const batch = synopses.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`[TrialEmbeddingService] Embedding batch ${batchNum} — ${batch.length} synopses`);

        for (const s of batch) {
            console.log(`[TrialEmbeddingService] Embedding: ${s.nctId}`);
            const embedding = await claudeEmbedOne(s.synopsis, apiKey);
            allEmbeddings.push({ nctId: s.nctId, embedding });
        }
    }

    return {
        embeddings: allEmbeddings,
        totalInputTokens: 0,
    };
}