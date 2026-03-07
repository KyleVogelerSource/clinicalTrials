import express, { Request, Response } from "express";
import { createEmptyClinicalTrialStudiesResponse } from "./clinicalTrials/services/ClinicalTrialsService";

const app = express();
const port = 3000;

app.use(express.json());

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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

//http://localhost:3000/api/clinical-trials/empty-response