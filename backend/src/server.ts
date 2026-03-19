import express, { Request, Response } from "express";
import { searchClinicalTrials, createEmptyClinicalTrialStudiesResponse, searchAndBuildCandidatePool } from "./services/ClinicalTrialsService";
import { ClinicalTrialsApiClientError, ClinicalTrialsApiTimeoutError } from "./client/ClinicalTrialsApiClient";
import { validateSearchRequest } from "./validators/ClinicalTrialSearchValidator";
import { ClinicalTrialSearchRequest } from "../shared/src/dto/ClinicalTrialSearchRequest";
import { ReferenceTrial } from "../src/models/NormalizedTrial";

const app = express();
const port = 3000;

app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, message: "API is running" });
});

// POST /api/clinical-trials/search
app.post("/api/clinical-trials/search", async (req: Request, res: Response) => {
  const searchRequest = req.body as ClinicalTrialSearchRequest;

  const validation = validateSearchRequest(searchRequest);
  if (!validation.valid) {
    res.status(400).json({
      error: "Bad Request",
      message: "One or more request body fields are invalid.",
      details: validation.errors,
    });
    return;
  }

  try {
    const response = await searchClinicalTrials(searchRequest);
    res.status(200).json(response);
  } catch (err) {
    if (err instanceof ClinicalTrialsApiTimeoutError) {
      res.status(504).json({ error: "Gateway Timeout", message: err.message });
      return;
    }
    if (err instanceof ClinicalTrialsApiClientError) {
      res.status(502).json({ error: "Bad Gateway", message: err.message });
      return;
    }
    console.error("Unexpected error in POST /api/clinical-trials/search:", err);
    res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
  }
});

//POST /api/clinical-trials/candidate-pool
app.post("/api/clinical-trials/candidate-pool", async (req: Request, res: Response) => {
  const { cap, referenceTrial, ...searchRequest } =
    req.body as ClinicalTrialSearchRequest & {
      cap?: number;
      referenceTrial?: ReferenceTrial;
    };

  const validation = validateSearchRequest(searchRequest);
  if (!validation.valid) {
    res.status(400).json({
      error: "Bad Request",
      message: "One or more request body fields are invalid.",
      details: validation.errors,
    });
    return;
  }

  try {
    const pool = await searchAndBuildCandidatePool(searchRequest, {
      cap,
      referenceTrial,
    });
    res.status(200).json(pool);
  } catch (err) {
    handleApiError(err, res, "POST /api/clinical-trials/candidate-pool");
  }
});

function handleApiError(err: unknown, res: Response, context: string): void {
  if (err instanceof ClinicalTrialsApiTimeoutError) {
    res.status(504).json({ error: "Gateway Timeout", message: err.message });
    return;
  }
  if (err instanceof ClinicalTrialsApiClientError) {
    res.status(502).json({ error: "Bad Gateway", message: err.message });
    return;
  }
  console.error(`Unexpected error in ${context}:`, err);
  res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
}

app.get("/api/clinical-trials/empty-response", (_req: Request, res: Response) => {
  res.status(200).json(createEmptyClinicalTrialStudiesResponse());
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});