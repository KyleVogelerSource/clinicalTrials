import express, { Request, Response } from "express";
import cors from "cors";
import { searchClinicalTrials, createEmptyClinicalTrialStudiesResponse } from "./services/ClinicalTrialsService";
import { ClinicalTrialsApiClientError, ClinicalTrialsApiTimeoutError } from "./client/ClinicalTrialsApiClient";
import { validateSearchRequest } from "./validators/ClinicalTrialSearchValidator";
import { ClinicalTrialSearchRequest } from "../shared/src/dto/ClinicalTrialSearchRequest";
import { initializeDatabase, isDatabaseConnected } from "./storage/PostgresClient";

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

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
    databaseConnected: isDatabaseConnected(),
  });
});

app.get("/api/debug/status", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "clinicaltrials-backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    databaseConnected: isDatabaseConnected(),
  });
});

// POST /api/clinical-trials/search
// Accepts a ClinicalTrialSearchRequest JSON body.
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


app.get("/api/clinical-trials/empty-response", (_req: Request, res: Response) => {
  res.status(200).json(createEmptyClinicalTrialStudiesResponse());
});

// POST /api/clinical-trials/results — placeholder for real implementation
app.post("/api/clinical-trials/results", (_req: Request, res: Response) => {
    res.status(501).json({ message: "Not yet implemented" });
});

async function bootstrap() {
  await initializeDatabase();

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
