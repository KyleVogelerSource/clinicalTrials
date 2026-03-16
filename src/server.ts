import express, { Request, Response } from "express";
import { createEmptyClinicalTrialStudiesResponse } from "../backend/src/services/ClinicalTrialsService";
import { TrialResultsResponse } from "../shared/src/dto/TrialResultsResponse";

const app = express();
const port = 3000;

app.use(express.json());

// Allow requests from the Angular dev server
app.use((_req: Request, res: Response, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    message: "API is running",
  });
});

//http://localhost:3000/api/clinical-trials/empty-response
app.get("/api/clinical-trials/empty-response", (_req: Request, res: Response) => {
  const response = createEmptyClinicalTrialStudiesResponse();

  res.status(200).json(response);
});

const mockTrialResultsResponse: TrialResultsResponse = {
    overallScore: 73,
    totalTrialsFound: 511,
    queryCondition: "Type 2 Diabetes",
    terminationReasons: [
        { reason: "Slow Recruitment", count: 42 },
        { reason: "Sponsor Decision", count: 38 },
        { reason: "Safety Concerns", count: 27 },
        { reason: "Lack of Efficacy", count: 19 },
        { reason: "Protocol Deviation", count: 14 },
        { reason: "Funding Loss", count: 11 },
        { reason: "Regulatory Issue", count: 8 },
        { reason: "Other", count: 23 },
    ],
    avgRecruitmentDays: 487,
    participantTarget: 240,
    recruitmentByImpact: [
        { label: "High Impact", avgDays: 312, participantCount: 187 },
        { label: "Medium Impact", avgDays: 487, participantCount: 243 },
        { label: "Low Impact", avgDays: 621, participantCount: 81 },
    ],
    timelineBuckets: [
        { patientBucket: "0–50",    estimatedDays: 180, actualDays: 210 },
        { patientBucket: "51–100",  estimatedDays: 270, actualDays: 305 },
        { patientBucket: "101–250", estimatedDays: 365, actualDays: 420 },
        { patientBucket: "251–500", estimatedDays: 480, actualDays: 0   },
        { patientBucket: "500+",    estimatedDays: 720, actualDays: 0   },
    ],
    generatedAt: new Date().toISOString(),
};

// POST /api/clinical-trials/results — stub returning mock data
app.post("/api/clinical-trials/results", (_req: Request, res: Response) => {
    res.status(200).json(mockTrialResultsResponse);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});