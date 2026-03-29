import { NormalizedTrial } from "../models/NormalizedTrial";
import { TrialResultsRequest } from "../../../shared/src/dto/TrialResultsRequest";
import { TrialResultsResponse } from "../../../shared/src/dto/TrialResultsResponse";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

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

    const systemPrompt = `You are a clinical trial analyst. Analyze the provided clinical trial data and return a JSON object matching the exact TypeScript interface below. Return ONLY valid JSON with no markdown, no explanation, no backticks.

        interface TerminationReasonBar { reason: string; count: number; }
        interface RecruitmentImpactBar { label: string; avgDays: number; participantCount: number; }
        interface TimelineBar { patientBucket: string; estimatedDays: number; actualDays: number; }
        interface TrialResultsResponse {
        overallScore: number;          // 0-100 feasibility score based on trial characteristics
        totalTrialsFound: number;      // total number of trials analyzed
        queryCondition: string | null; // the primary condition searched
        terminationReasons: TerminationReasonBar[];  // inferred likely termination risk factors with estimated counts
        avgRecruitmentDays: number;    // estimated avg days to recruit based on enrollment counts and trial durations
        participantTarget: number;     // median enrollment target across trials
        recruitmentByImpact: RecruitmentImpactBar[]; // 3 buckets: High/Medium/Low Impact with avgDays and participantCount
        timelineBuckets: TimelineBar[]; // 5 patient count buckets: "0–50", "51–100", "101–250", "251–500", "500+" with estimated/actual days
        generatedAt: string;           // ISO timestamp
        }`;

    const userPrompt = `Analyze these ${trials.length} clinical trials for the condition "${request.condition ?? "unspecified"}".

    Search parameters:
    - Phase: ${request.phase ?? "Any"}
    - Sex: ${request.sex ?? "Any"}
    - Age range: ${request.minAge ?? "Any"} to ${request.maxAge ?? "Any"}
    - Allocation: ${request.allocationType ?? "Any"}
    - Intervention model: ${request.interventionModel ?? "Any"}

    Trials data:
    ${trialsJson}

    Generate a realistic TrialResultsResponse JSON based on actual patterns in this data. Use real enrollment counts, dates, and statuses from the trials to derive meaningful estimates. For terminationReasons, analyze overallStatus fields and typical trial failure modes. For timeline buckets, use actual completion vs start dates where available.`;

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
            system: systemPrompt,
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

    try {
        return JSON.parse(cleaned) as TrialResultsResponse;
    } catch {
        throw new Error(`Failed to parse AI response as JSON: ${cleaned.substring(0, 200)}`);
    }
}