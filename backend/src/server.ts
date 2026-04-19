import "dotenv/config";
import { searchClinicalTrials, createEmptyClinicalTrialStudiesResponse, searchAndBuildCandidatePool } from "./services/ClinicalTrialsService";
import { ClinicalTrialsApiClientError, ClinicalTrialsApiTimeoutError } from "./client/ClinicalTrialsApiClient";
import { validateSearchRequest } from "./validators/ClinicalTrialSearchValidator";
import { ClinicalTrialSearchRequest } from "./dto/ClinicalTrialSearchRequest";
import { NormalizedTrial, ReferenceTrial } from "../src/models/NormalizedTrial";
import { TrialResultsRequest } from "./dto/TrialResultsRequest";
import { generateAIResults } from "./services/AIResultsService";
import { runBenchmarkPipeline } from "./services/TrialBenchmarkPipeline";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { initializeDatabase, isDatabaseConnected, probeDatabaseConnection } from "./storage/PostgresClient";
import { registerUser, loginUser } from "./auth/AuthService";
import { authenticateToken, AuthenticatedRequest, requireAction, userHasAction } from "./auth/authMiddleware";
import { assignRoleAction, assignUserRole, createAdminUser, createRole, deleteRoleAction, deleteUserRole, getAdminSnapshot } from "./services/AdminService";
import { SavedSearchShareRequest, SavedSearchUpsertRequest } from "./dto/SavedSearchDto";
import { TrialCompareRequest } from "./dto/TrialCompareDto";
import { createSavedSearch, deleteOwnedSavedSearch, getAccessibleSavedSearch, listOwnedSavedSearches, listSharedSavedSearches, runSavedSearch, shareSavedSearch, updateAccessibleSavedSearch } from "./services/SavedSearchService";
import { compareTrials } from "./services/TrialCompareService";
import { validateSavedSearchShareRequest, validateSavedSearchUpsertRequest } from "./validators/SavedSearchValidator";
import { validateTrialCompareRequest } from "./validators/TrialCompareValidator";

export const app = express();
const port = Number(process.env.PORT ?? 3000);

function requireDatabaseConnection(_req: Request, res: Response, next: NextFunction) {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: "Service Unavailable",
      message: "Database is unavailable. Retry when database connectivity is restored.",
    });
    return;
  }

  next();
}

app.use(express.json());
app.use(cors());

const allowedOrigins = ["http://localhost:4200", "https://d8rtqu8bq9oyq.cloudfront.net", "https://cardinaltrials.com"];

// Allow requests from the Angular dev server and production CloudFront
app.use((_req: Request, res: Response, next: NextFunction) => {
  const origin = _req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

app.get("/api/debug/status", async (_req: Request, res: Response) => {
  const databaseDiagnostics = await probeDatabaseConnection();
  const databaseFailureMessage = !databaseDiagnostics.connected && databaseDiagnostics.failure
    ? [
      `Database connection probe failed at ${databaseDiagnostics.failure.capturedAt}.`,
      `Operation: ${databaseDiagnostics.failure.operation}.`,
      `Error: ${databaseDiagnostics.failure.name} - ${databaseDiagnostics.failure.message}.`,
      databaseDiagnostics.failure.code ? `Code: ${databaseDiagnostics.failure.code}.` : null,
      databaseDiagnostics.failure.detail ? `Detail: ${databaseDiagnostics.failure.detail}.` : null,
      databaseDiagnostics.failure.hint ? `Hint: ${databaseDiagnostics.failure.hint}.` : null,
      `Target: ${databaseDiagnostics.configuration.user}@${databaseDiagnostics.configuration.host}:${databaseDiagnostics.configuration.port}/${databaseDiagnostics.configuration.database}.`,
      databaseDiagnostics.lastSuccessfulConnectionAt
        ? `Last successful connection at ${databaseDiagnostics.lastSuccessfulConnectionAt}.`
        : "No successful database connection has been recorded since startup.",
    ].filter((part): part is string => Boolean(part)).join(" ")
    : null;

  res.status(200).json({
    ok: true,
    service: "clinicaltrials-backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    databaseConnected: isDatabaseConnected(),
    databaseDiagnostics,
    databaseFailureMessage,
  });
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
  const { cap, referenceTrial, requiredConditions, ineligibleConditions, ...searchRequest } =
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
      requiredConditions,
      ineligibleConditions,
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

// POST /api/clinical-trials/results — AI-powered analysis of selected trials
app.post("/api/clinical-trials/results", async (req: Request, res: Response) => {
  const { trials, ...request } = req.body as TrialResultsRequest & { trials?: NormalizedTrial[] };

  if (!Array.isArray(trials) || trials.length === 0) {
    res.status(400).json({
      error: "Bad Request",
      message: "A non-empty 'trials' array is required.",
    });
    return;
  }

  try {
    const results = await generateAIResults(request, trials);
    res.status(200).json(results);
  } catch (err) {
    console.error("Unexpected error in POST /api/clinical-trials/results:", err);
    res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
  }
});

// POST /api/clinical-trials/benchmark
// Accepts the user's scenario request and a pre-built candidate pool.
// Returns Top-K trials ranked by cosine similarity to the proposed design.
app.post("/api/clinical-trials/benchmark", async (req: Request, res: Response) => {
  const { trials, proposedTrial, topK, ...request } = req.body as TrialResultsRequest & {
    trials?: NormalizedTrial[];
    proposedTrial?: NormalizedTrial;
    topK?: number;
  };

  if (!Array.isArray(trials) || trials.length === 0) {
    res.status(400).json({
      error: "Bad Request",
      message: "A non-empty 'trials' array is required.",
    });
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
  const voyageKey = process.env.VOYAGE_API_KEY ?? "";

  if (!anthropicKey) {
    res.status(500).json({
      error: "Configuration Error",
      message: "ANTHROPIC_API_KEY is not configured.",
    });
    return;
  }

  if (!voyageKey) {
    res.status(500).json({
      error: "Configuration Error",
      message: "VOYAGE_API_KEY is not configured.",
    });
    return;
  }

  try {
    const result = await runBenchmarkPipeline(
      request,
      trials,
      proposedTrial ?? null,
      topK ?? 15,
      anthropicKey,
      voyageKey
    );
    res.status(200).json(result);
  } catch (err) {
    console.error("Unexpected error in POST /api/clinical-trials/benchmark:", err);
    res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
  }
});

app.post(
  "/api/clinical-trials/compare",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("trial_benchmarking"),
  async (req: AuthenticatedRequest, res: Response) => {
    const requestBody = req.body as Partial<TrialCompareRequest>;
    const validation = validateTrialCompareRequest(requestBody);
    if (!validation.valid) {
      res.status(400).json({
        error: "Bad Request",
        message: "One or more request body fields are invalid.",
        details: validation.errors,
      });
      return;
    }

    try {
      const comparison = await compareTrials(requestBody as TrialCompareRequest);
      res.status(200).json(comparison);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("TRIAL_NOT_FOUND:")) {
        res.status(404).json({ error: "Not Found", message: err.message.replace("TRIAL_NOT_FOUND:", "Trial not found: ") });
        return;
      }

      handleApiError(err, res, "POST /api/clinical-trials/compare");
    }
  }
);

// POST /api/auth/register
app.post("/api/auth/register", requireDatabaseConnection, async (req: Request, res: Response) => {
  const { username, password, firstName, lastName } = req.body as Record<string, string>;

  if (!username?.trim() || !password || !firstName?.trim() || !lastName?.trim()) {
    res.status(400).json({
      error: "Bad Request",
      message: "username, password, firstName, and lastName are required.",
    });
    return;
  }

  try {
    const result = await registerUser({ username: username.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "USERNAME_TAKEN") {
      res.status(409).json({ error: "Conflict", message: "Username already taken." });
      return;
    }
    console.error("Unexpected error in POST /api/auth/register:", err);
    res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", requireDatabaseConnection, async (req: Request, res: Response) => {
  const { username, password } = req.body as Record<string, string>;

  if (!username?.trim() || !password) {
    res.status(400).json({ error: "Bad Request", message: "username and password are required." });
    return;
  }

  try {
    const result = await loginUser({ username: username.trim(), password });
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
      res.status(401).json({ error: "Unauthorized", message: "Invalid username or password." });
      return;
    }
    console.error("Unexpected error in POST /api/auth/login:", err);
    res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
  }
});

// GET /api/auth/has-action/:action
app.get(
  "/api/auth/has-action/:action",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const action = (req.params.action as string)?.trim();
    if (!action) {
      res.status(400).json({ error: "Bad Request", message: "Action is required." });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    try {
      const allowed = await userHasAction(userId, action);

      res.status(200).json({ action, allowed });
    } catch (err) {
      console.error("Unexpected error in GET /api/auth/has-action/:action:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/saved-searches",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const username = req.user?.username ?? "";
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    const requestBody = req.body as Partial<SavedSearchUpsertRequest>;
    const validation = validateSavedSearchUpsertRequest(requestBody);
    if (!validation.valid) {
      res.status(400).json({
        error: "Bad Request",
        message: "One or more request body fields are invalid.",
        details: validation.errors,
      });
      return;
    }

    try {
      const savedSearch = await createSavedSearch(
        userId,
        username,
        requestBody as SavedSearchUpsertRequest
      );
      res.status(201).json(savedSearch);
    } catch (err) {
      if (err instanceof Error && err.message === "DUPLICATE_SAVED_SEARCH") {
        res.status(409).json({ error: "Conflict", message: "An equivalent saved search already exists for this user." });
        return;
      }

      console.error("Unexpected error in POST /api/saved-searches:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.get(
  "/api/saved-searches",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    try {
      const savedSearches = await listOwnedSavedSearches(userId);
      res.status(200).json(savedSearches);
    } catch (err) {
      console.error("Unexpected error in GET /api/saved-searches:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.get(
  "/api/saved-searches/shared-with-me",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    try {
      const allowed = await userHasAction(userId, "saved_searches_view_shared");
      if (!allowed) {
        res.status(200).json([]);
        return;
      }

      const savedSearches = await listSharedSavedSearches(userId);
      res.status(200).json(savedSearches);
    } catch (err) {
      console.error("Unexpected error in GET /api/saved-searches/shared-with-me:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.get(
  "/api/saved-searches/:id",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const savedSearchId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    if (!Number.isInteger(savedSearchId)) {
      res.status(400).json({ error: "Bad Request", message: "Saved search id must be an integer." });
      return;
    }

    try {
      const allowSharedView = await userHasAction(userId, "saved_searches_view_shared");
      const savedSearch = await getAccessibleSavedSearch(savedSearchId, userId, allowSharedView);
      if (!savedSearch) {
        res.status(404).json({ error: "Not Found", message: "Saved search not found." });
        return;
      }

      res.status(200).json(savedSearch);
    } catch (err) {
      console.error("Unexpected error in GET /api/saved-searches/:id:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.put(
  "/api/saved-searches/:id",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const savedSearchId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    if (!Number.isInteger(savedSearchId)) {
      res.status(400).json({ error: "Bad Request", message: "Saved search id must be an integer." });
      return;
    }

    const requestBody = req.body as Partial<SavedSearchUpsertRequest>;
    const validation = validateSavedSearchUpsertRequest(requestBody);
    if (!validation.valid) {
      res.status(400).json({
        error: "Bad Request",
        message: "One or more request body fields are invalid.",
        details: validation.errors,
      });
      return;
    }

    try {
      const allowSharedView = await userHasAction(userId, "saved_searches_view_shared");
      const savedSearch = await updateAccessibleSavedSearch(
        savedSearchId,
        userId,
        requestBody as SavedSearchUpsertRequest,
        false,
        allowSharedView
      );
      res.status(200).json(savedSearch);
    } catch (err) {
      if (err instanceof Error && err.message === "SAVED_SEARCH_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Saved search not found." });
        return;
      }
      if (err instanceof Error && err.message === "SAVED_SEARCH_FORBIDDEN") {
        res.status(403).json({ error: "Forbidden", message: "You do not have permission to edit this saved search." });
        return;
      }
      if (err instanceof Error && err.message === "DUPLICATE_SAVED_SEARCH") {
        res.status(409).json({ error: "Conflict", message: "An equivalent saved search already exists for this user." });
        return;
      }

      console.error("Unexpected error in PUT /api/saved-searches/:id:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.delete(
  "/api/saved-searches/:id",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const savedSearchId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    if (!Number.isInteger(savedSearchId)) {
      res.status(400).json({ error: "Bad Request", message: "Saved search id must be an integer." });
      return;
    }

    try {
      await deleteOwnedSavedSearch(savedSearchId, userId);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === "SAVED_SEARCH_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Saved search not found." });
        return;
      }
      if (err instanceof Error && err.message === "SAVED_SEARCH_FORBIDDEN") {
        res.status(403).json({ error: "Forbidden", message: "Only the owner can delete this saved search." });
        return;
      }

      console.error("Unexpected error in DELETE /api/saved-searches/:id:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/saved-searches/:id/share",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const savedSearchId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    if (!Number.isInteger(savedSearchId)) {
      res.status(400).json({ error: "Bad Request", message: "Saved search id must be an integer." });
      return;
    }

    const requestBody = req.body as Partial<SavedSearchShareRequest>;
    const validation = validateSavedSearchShareRequest(requestBody);
    if (!validation.valid) {
      res.status(400).json({
        error: "Bad Request",
        message: "One or more request body fields are invalid.",
        details: validation.errors,
      });
      return;
    }

    try {
      const sharedSearch = await shareSavedSearch(savedSearchId, userId, requestBody as SavedSearchShareRequest);
      res.status(200).json(sharedSearch);
    } catch (err) {
      if (err instanceof Error && err.message === "SAVED_SEARCH_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Saved search not found." });
        return;
      }
      if (err instanceof Error && err.message === "SAVED_SEARCH_FORBIDDEN") {
        res.status(403).json({ error: "Forbidden", message: "Only the owner can manage sharing for this saved search." });
        return;
      }
      if (err instanceof Error && err.message === "TARGET_USER_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Target user not found." });
        return;
      }
      if (err instanceof Error && err.message === "TARGET_USER_INVALID") {
        res.status(400).json({ error: "Bad Request", message: "Saved searches cannot be shared back to the owner." });
        return;
      }

      console.error("Unexpected error in POST /api/saved-searches/:id/share:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/saved-searches/:id/run",
  requireDatabaseConnection,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const savedSearchId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ error: "Unauthorized", message: "No user in token payload." });
      return;
    }

    if (!Number.isInteger(savedSearchId)) {
      res.status(400).json({ error: "Bad Request", message: "Saved search id must be an integer." });
      return;
    }

    try {
      const allowSharedView = await userHasAction(userId, "saved_searches_view_shared");
      const result = await runSavedSearch(savedSearchId, userId, allowSharedView, false);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === "SAVED_SEARCH_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Saved search not found." });
        return;
      }
      if (err instanceof Error && err.message === "SAVED_SEARCH_FORBIDDEN") {
        res.status(403).json({ error: "Forbidden", message: "You do not have permission to run this saved search." });
        return;
      }
      if (err instanceof Error && err.message.startsWith("SAVED_SEARCH_CRITERIA_INVALID:")) {
        const rawDetails = err.message.replace("SAVED_SEARCH_CRITERIA_INVALID:", "");
        let details: unknown = [];
        try {
          details = JSON.parse(rawDetails);
        } catch {
          details = [];
        }

        res.status(400).json({
          error: "Bad Request",
          message: "Saved search criteria are invalid. Please update the saved search and try again.",
          details,
        });
        return;
      }

      handleApiError(err, res, "POST /api/saved-searches/:id/run");
    }
  }
);

app.get(
  "/api/admin/summary",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const snapshot = await getAdminSnapshot();
      res.status(200).json(snapshot);
    } catch (err) {
      console.error("Unexpected error in GET /api/admin/summary:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/admin/users",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { username, password, firstName, lastName } = req.body as Record<string, string>;

    if (!username?.trim() || !password || !firstName?.trim() || !lastName?.trim()) {
      res.status(400).json({
        error: "Bad Request",
        message: "username, password, firstName, and lastName are required.",
      });
      return;
    }

    try {
      const user = await createAdminUser({
        username: username.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof Error && err.message === "USERNAME_TAKEN") {
        res.status(409).json({ error: "Conflict", message: "Username already taken." });
        return;
      }
      console.error("Unexpected error in POST /api/admin/users:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/admin/roles",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body as Record<string, string>;

    if (!name?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "Role name is required." });
      return;
    }

    try {
      const role = await createRole(name);
      res.status(201).json(role);
    } catch (err) {
      if (err instanceof Error && err.message === "ROLE_EXISTS") {
        res.status(409).json({ error: "Conflict", message: "Role already exists." });
        return;
      }
      console.error("Unexpected error in POST /api/admin/roles:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/admin/role-actions",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { roleId, actionId } = req.body as { roleId?: number; actionId?: number };

    if (!Number.isInteger(roleId) || !Number.isInteger(actionId)) {
      res.status(400).json({ error: "Bad Request", message: "roleId and actionId are required integers." });
      return;
    }

    try {
      const roleAction = await assignRoleAction(Number(roleId), Number(actionId));
      res.status(201).json(roleAction);
    } catch (err) {
      if (err instanceof Error && err.message === "ROLE_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Role not found." });
        return;
      }
      if (err instanceof Error && err.message === "ACTION_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Action not found." });
        return;
      }
      if (err instanceof Error && err.message === "ROLE_ACTION_EXISTS") {
        res.status(409).json({ error: "Conflict", message: "Role is already assigned to this action." });
        return;
      }
      console.error("Unexpected error in POST /api/admin/role-actions:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.post(
  "/api/admin/user-roles",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (req: AuthenticatedRequest, res: Response) => {
    const { userId, roleId } = req.body as { userId?: number; roleId?: number };

    if (!Number.isInteger(userId) || !Number.isInteger(roleId)) {
      res.status(400).json({ error: "Bad Request", message: "userId and roleId are required integers." });
      return;
    }

    try {
      const userRole = await assignUserRole(Number(userId), Number(roleId));
      res.status(201).json(userRole);
    } catch (err) {
      if (err instanceof Error && err.message === "USER_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "User not found." });
        return;
      }
      if (err instanceof Error && err.message === "ROLE_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Role not found." });
        return;
      }
      if (err instanceof Error && err.message === "USER_ROLE_EXISTS") {
        res.status(409).json({ error: "Conflict", message: "User is already assigned to this role." });
        return;
      }
      console.error("Unexpected error in POST /api/admin/user-roles:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.delete(
  "/api/admin/role-actions/:roleId/:actionId",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (req: AuthenticatedRequest, res: Response) => {
    const roleId = Number(req.params.roleId);
    const actionId = Number(req.params.actionId);

    if (!Number.isInteger(roleId) || !Number.isInteger(actionId)) {
      res.status(400).json({ error: "Bad Request", message: "roleId and actionId must be integers." });
      return;
    }

    try {
      await deleteRoleAction(roleId, actionId);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === "ROLE_ACTION_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "Role-action relation not found." });
        return;
      }
      console.error("Unexpected error in DELETE /api/admin/role-actions/:roleId/:actionId:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

app.delete(
  "/api/admin/user-roles/:userId/:roleId",
  requireDatabaseConnection,
  authenticateToken,
  requireAction("user_roles"),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = Number(req.params.userId);
    const roleId = Number(req.params.roleId);

    if (!Number.isInteger(userId) || !Number.isInteger(roleId)) {
      res.status(400).json({ error: "Bad Request", message: "userId and roleId must be integers." });
      return;
    }

    try {
      await deleteUserRole(userId, roleId);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === "USER_ROLE_NOT_FOUND") {
        res.status(404).json({ error: "Not Found", message: "User-role relation not found." });
        return;
      }
      console.error("Unexpected error in DELETE /api/admin/user-roles/:userId/:roleId:", err);
      res.status(500).json({ error: "Internal Server Error", message: "An unexpected error occurred." });
    }
  }
);

export async function bootstrap() {
  try {
    await initializeDatabase();
  } catch (error) {
    console.warn("Database initialization failed. Starting server without database connectivity.", error);
  }

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}