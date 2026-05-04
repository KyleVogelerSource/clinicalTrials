import { NormalizedTrial } from "../models/NormalizedTrial";
import { TrialResultsRequest } from "../dto/TrialResultsRequest";
import { TrialResultsResponse } from "../dto/TrialResultsResponse";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// JSON Schema for the response — stricter than embedding the TypeScript interface
const RESPONSE_SCHEMA = {
    type: "object",
    required: [
        "overallScore",
        "totalTrialsFound",
        "queryCondition",
        "terminationReasons",
        "estimatedDurationDays",
        "participantTarget",
        "recruitmentByImpact",
        "timelineBuckets",
    ],
    properties: {
        overallScore: { type: "number", minimum: 0, maximum: 100 },
        totalTrialsFound: { type: "integer", minimum: 0 },
        queryCondition: { type: ["string", "null"] },
        terminationReasons: {
            type: "array",
            items: {
                type: "object",
                required: ["reason", "count"],
                properties: {
                    reason: { type: "string" },
                    count: { type: "integer", minimum: 0 },
                },
            },
        },
        estimatedDurationDays: { type: "number", minimum: 0 },
        participantTarget: { type: "number", minimum: 0 },
        recruitmentByImpact: {
            type: "array",
            items: {
                type: "object",
                required: ["label", "avgDays", "participantCount"],
                properties: {
                    label: { type: "string" },
                    avgDays: { type: "number", minimum: 0 },
                    participantCount: { type: "integer", minimum: 0 },
                },
            },
        },
        timelineBuckets: {
            type: "array",
            items: {
                type: "object",
                required: ["patientBucket", "estimatedDays", "actualDays"],
                properties: {
                    patientBucket: { type: "string" },
                    estimatedDays: { type: "number", minimum: 0 },
                    actualDays: { type: "number", minimum: 0 },
                },
            },
        },
    },
    additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a clinical trial analyst. Given trial data, return a JSON object matching the provided schema exactly.
Return ONLY valid JSON. No markdown, no explanation, no backticks, no trailing commas.
Derive all values from the actual trial data provided — do not invent numbers.`;

export async function generateAIResults(request: TrialResultsRequest, trials: NormalizedTrial[]): Promise<TrialResultsResponse> {
    const trialsJson = JSON.stringify(
        trials.map((t) => ({
            nctId: t.nctId,
            briefTitle: t.briefTitle,
            phase: t.phase,
            studyType: t.studyType,
            overallStatus: t.overallStatus,
            enrollmentCount: t.enrollmentCount,
            enrollmentType: t.enrollmentType,
            startDate: t.startDate,
            completionDate: t.completionDate,
            conditions: t.conditions,
            interventions: t.interventions,
            sex: t.sex,
            minimumAge: t.minimumAge,
            maximumAge: t.maximumAge,
            sponsor: t.sponsor,
        }))
    );

    const userPrompt = `Analyze these ${trials.length} clinical trials for the condition "${request.condition ?? "unspecified"}".

Search parameters:
- Phase: ${request.phase ?? "Any"}
- Sex: ${request.sex ?? "Any"}
- Age range: ${request.minAge ?? "Any"} to ${request.maxAge ?? "Any"}
- Allocation: ${request.allocationType ?? "Any"}
- Intervention model: ${request.interventionModel ?? "Any"}

Required JSON schema:
${JSON.stringify(RESPONSE_SCHEMA, null, 2)}

Trials data:
${trialsJson}

Generate a TrialResultsResponse JSON based on actual patterns in this data.
- overallScore: 0–100 feasibility score based on trial characteristics
- Use real enrollment counts, dates, and statuses to derive meaningful estimates
- terminationReasons: analyze overallStatus fields and typical trial failure modes
- timelineBuckets must use exactly these 5 patient count labels: "0–50", "51–100", "101–250", "251–500", "500+"
- recruitmentByImpact must use exactly these 3 labels: "High Impact", "Medium Impact", "Low Impact"
- Use actual completion vs start dates where available for timeline data`;

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 2000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: TrialResultsResponse;
    try {
        parsed = JSON.parse(cleaned) as TrialResultsResponse;
    } catch {
        throw new Error(`Failed to parse AI response as JSON: ${cleaned.substring(0, 200)}`);
    }

    // Always stamp with a server-authoritative timestamp
    parsed.generatedAt = new Date().toISOString();

    return parsed;
}