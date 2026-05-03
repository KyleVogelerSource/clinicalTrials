import { ClinicalTrialStudiesResponse } from "../dto/ClinicalTrialStudiesResponse";
import { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";
import { SavedSearchRecord, SavedSearchRunRecord, SavedSearchShareRecord, SavedSearchShareRequest, SavedSearchUpsertRequest } from "../dto/SavedSearchDto";
import { getDbPool } from "../storage/PostgresClient";
import { searchClinicalTrials } from "./ClinicalTrialsService";
import { buildSavedSearchCanonicalKey, normalizeSavedSearchCriteria } from "./SavedSearchCriteriaNormalizer";
import { normalizeTrialStudy } from "./TrialNormalizer";
import { validateSearchRequest } from "../validators/ClinicalTrialSearchValidator";

interface SavedSearchRow {
  id: number;
  owner_user_id: number;
  owner_username: string;
  name: string;
  description: string | null;
  criteria_json: ClinicalTrialSearchRequest | string;
  visibility: "private" | "shared";
  created_at: string;
  updated_at: string;
  last_known_count?: number | null;
  last_run_at?: string | null;
  is_owner?: boolean;
  access_can_view?: boolean;
  access_can_run?: boolean;
  access_can_edit?: boolean;
}

interface DatabaseConstraintError extends Error {
  code?: string;
  constraint?: string;
}

type RuntimeCriteria = ClinicalTrialSearchRequest;

const PHASE_LABEL_MAP: Record<string, string> = {
  "Early Phase 1": "EARLY_PHASE1",
  "Phase 1": "PHASE1",
  "Phase 1/Phase 2": "PHASE1 OR PHASE2",
  "Phase 2": "PHASE2",
  "Phase 2/Phase 3": "PHASE2 OR PHASE3",
  "Phase 3": "PHASE3",
  "Phase 4": "PHASE4",
  "N/A": "NA",
};

const INTERVENTION_MODEL_LABEL_MAP: Record<string, string> = {
  "Single Group Assignment": "SINGLE_GROUP",
  "Parallel Assignment": "PARALLEL",
  "Crossover Assignment": "CROSSOVER",
  "Factorial Assignment": "FACTORIAL",
  "Sequential Assignment": "SEQUENTIAL",
};

const PHASE_RUNTIME_MAP: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PHASE_LABEL_MAP).map(([key, value]) => [key.toLowerCase(), value])),
  na: "NA",
  "n/a": "NA",
  early_phase1: "EARLY_PHASE1",
  phase1: "PHASE1",
  phase2: "PHASE2",
  phase3: "PHASE3",
  phase4: "PHASE4",
};

const INTERVENTION_MODEL_RUNTIME_MAP: Record<string, string> = {
  ...Object.fromEntries(Object.entries(INTERVENTION_MODEL_LABEL_MAP).map(([key, value]) => [key.toLowerCase(), value])),
  single_group: "SINGLE_GROUP",
  parallel: "PARALLEL",
  crossover: "CROSSOVER",
  factorial: "FACTORIAL",
  sequential: "SEQUENTIAL",
};

const SEX_RUNTIME_MAP: Record<string, string> = {
  all: "ALL",
  female: "FEMALE",
  male: "MALE",
};

function parseCriteriaJson(value: ClinicalTrialSearchRequest | string): ClinicalTrialSearchRequest {
  return typeof value === "string"
    ? JSON.parse(value) as ClinicalTrialSearchRequest
    : value;
}

function normalizeCriteriaForExecution(criteria: RuntimeCriteria): ClinicalTrialSearchRequest {
  const normalized: ClinicalTrialSearchRequest = { ...criteria };

  if (typeof criteria.phase === "string") {
    const phase = criteria.phase.trim();
    normalized.phase = PHASE_RUNTIME_MAP[phase.toLowerCase()] ?? phase.toUpperCase();
  }

  if (typeof criteria.interventionModel === "string") {
    const interventionModel = criteria.interventionModel.trim();
    normalized.interventionModel = INTERVENTION_MODEL_RUNTIME_MAP[interventionModel.toLowerCase()] ?? interventionModel.toUpperCase();
  }

  if (typeof criteria.sex === "string") {
    const sex = criteria.sex.trim();
    normalized.sex = SEX_RUNTIME_MAP[sex.toLowerCase()] ?? sex.toUpperCase();
  }

  return normalized;
}

function mapSavedSearch(row: SavedSearchRow): SavedSearchRecord {
  const isOwner = Boolean(row.is_owner);
  const canView = isOwner || Boolean(row.access_can_view);
  const canRun = isOwner || Boolean(row.access_can_run);
  const canEdit = isOwner || Boolean(row.access_can_edit);

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    name: row.name,
    description: row.description,
    criteriaJson: parseCriteriaJson(row.criteria_json),
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastKnownCount: row.last_known_count ?? null,
    lastRunAt: row.last_run_at ?? null,
    permissions: {
      isOwner,
      canView,
      canRun,
      canEdit,
    },
  };
}

function isDuplicateCanonicalKeyError(error: unknown): boolean {
  const dbError = error as DatabaseConstraintError;
  return dbError?.code === "23505" && dbError.constraint === "saved_searches_owner_canonical_key_unique";
}

function normalizeUpsertInput(input: SavedSearchUpsertRequest) {
  const criteriaJson = normalizeSavedSearchCriteria(input.criteriaJson) as ClinicalTrialSearchRequest;

  return {
    name: input.name.trim(),
    description: input.description?.trim() ? input.description.trim() : null,
    criteriaJson,
    canonicalKey: buildSavedSearchCanonicalKey(input.criteriaJson),
    visibility: input.visibility,
  };
}

async function getSavedSearchRow(savedSearchId: number, userId: number): Promise<SavedSearchRow | null> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT ss.id,
            ss.owner_user_id,
            u.username AS owner_username,
            ss.name,
            ss.description,
            ss.criteria_json,
            ss.visibility,
            ss.created_at,
            ss.updated_at,
            (ss.owner_user_id = $2) AS is_owner,
            COALESCE(ssa.can_view, FALSE) AS access_can_view,
            COALESCE(ssa.can_run, FALSE) AS access_can_run,
            COALESCE(ssa.can_edit, FALSE) AS access_can_edit
     FROM saved_searches ss
     JOIN users u ON u.id = ss.owner_user_id
     LEFT JOIN saved_search_access ssa
       ON ssa.saved_search_id = ss.id AND ssa.user_id = $2
     WHERE ss.id = $1
     LIMIT 1`,
    [savedSearchId, userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return result.rows[0] as SavedSearchRow;
}

export async function createSavedSearch(
  ownerUserId: number,
  ownerUsername: string,
  input: SavedSearchUpsertRequest
): Promise<SavedSearchRecord> {
  const pool = getDbPool();
  const normalized = normalizeUpsertInput(input);

  try {
    const result = await pool.query(
      `INSERT INTO saved_searches (owner_user_id, name, description, criteria_json, canonical_key, visibility)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id,
                 owner_user_id,
                 name,
                 description,
                 criteria_json,
                 visibility,
                 created_at,
                 updated_at,
                 TRUE AS is_owner,
                 TRUE AS access_can_view,
                 TRUE AS access_can_run,
                 TRUE AS access_can_edit`,
      [ownerUserId, normalized.name, normalized.description, JSON.stringify(normalized.criteriaJson), normalized.canonicalKey, normalized.visibility]
    );

    const created = result.rows[0] as SavedSearchRow;
    created.owner_username = ownerUsername;
    return mapSavedSearch(created);
  } catch (error) {
    if (isDuplicateCanonicalKeyError(error)) {
      throw new Error("DUPLICATE_SAVED_SEARCH");
    }
    throw error;
  }
}

export async function listOwnedSavedSearches(userId: number): Promise<SavedSearchRecord[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT ss.id,
            ss.owner_user_id,
            u.username AS owner_username,
            ss.name,
            ss.description,
            ss.criteria_json,
            ss.visibility,
            ss.created_at,
            ss.updated_at,
            latest.result_count AS last_known_count,
            latest.executed_at AS last_run_at,
            TRUE AS is_owner,
            TRUE AS access_can_view,
            TRUE AS access_can_run,
            TRUE AS access_can_edit
     FROM saved_searches ss
     JOIN users u ON u.id = ss.owner_user_id
     LEFT JOIN LATERAL (
       SELECT ssr.result_count, ssr.executed_at
       FROM saved_search_runs ssr
       WHERE ssr.saved_search_id = ss.id
       ORDER BY ssr.executed_at DESC, ssr.id DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE ss.owner_user_id = $1
     ORDER BY ss.updated_at DESC, ss.id DESC`,
    [userId]
  );

  return result.rows.map((row) => mapSavedSearch(row as SavedSearchRow));
}

export async function listSharedSavedSearches(userId: number): Promise<SavedSearchRecord[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT ss.id,
            ss.owner_user_id,
            u.username AS owner_username,
            ss.name,
            ss.description,
            ss.criteria_json,
            ss.visibility,
            ss.created_at,
            ss.updated_at,
            latest.result_count AS last_known_count,
            latest.executed_at AS last_run_at,
            FALSE AS is_owner,
            CASE
              WHEN ss.visibility = 'shared' THEN TRUE
              ELSE COALESCE(ssa.can_view, FALSE)
            END AS access_can_view,
            COALESCE(ssa.can_run, FALSE) AS access_can_run,
            COALESCE(ssa.can_edit, FALSE) AS access_can_edit
     FROM saved_searches ss
     JOIN users u ON u.id = ss.owner_user_id
     LEFT JOIN saved_search_access ssa
       ON ssa.saved_search_id = ss.id
      AND ssa.user_id = $1
     LEFT JOIN LATERAL (
       SELECT ssr.result_count, ssr.executed_at
       FROM saved_search_runs ssr
       WHERE ssr.saved_search_id = ss.id
       ORDER BY ssr.executed_at DESC, ssr.id DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE (ss.visibility = 'shared' OR COALESCE(ssa.can_view, FALSE) = TRUE)
       AND ss.owner_user_id <> $1
     ORDER BY ss.updated_at DESC, ss.id DESC`,
    [userId]
  );

  return result.rows.map((row) => mapSavedSearch(row as SavedSearchRow));
}

export async function getAccessibleSavedSearch(
  savedSearchId: number,
  userId: number,
  allowSharedView: boolean
): Promise<SavedSearchRecord | null> {
  const row = await getSavedSearchRow(savedSearchId, userId);
  if (!row) {
    return null;
  }

  const isOwner = Boolean(row.is_owner);
  if (!isOwner && (!allowSharedView || !row.access_can_view)) {
    return null;
  }

  return mapSavedSearch(row);
}

export async function updateAccessibleSavedSearch(
  savedSearchId: number,
  userId: number,
  input: SavedSearchUpsertRequest,
  allowSharedEdit: boolean,
  allowSharedView: boolean
): Promise<SavedSearchRecord> {
  const current = await getSavedSearchRow(savedSearchId, userId);
  if (!current) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  const isOwner = Boolean(current.is_owner);
  const canEditShared = !isOwner && allowSharedEdit && Boolean(current.access_can_edit);
  if (!isOwner && !canEditShared) {
    throw new Error("SAVED_SEARCH_FORBIDDEN");
  }

  const pool = getDbPool();
  const normalized = normalizeUpsertInput(input);

  try {
    await pool.query(
      `UPDATE saved_searches
       SET name = $1,
           description = $2,
           criteria_json = $3::jsonb,
           canonical_key = $4,
           visibility = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        normalized.name,
        normalized.description,
        JSON.stringify(normalized.criteriaJson),
        normalized.canonicalKey,
        normalized.visibility,
        savedSearchId,
      ]
    );
  } catch (error) {
    if (isDuplicateCanonicalKeyError(error)) {
      throw new Error("DUPLICATE_SAVED_SEARCH");
    }
    throw error;
  }

  const updatedRow = await getSavedSearchRow(savedSearchId, userId);
  if (!updatedRow) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  const canReturnUpdated = Boolean(updatedRow.is_owner)
    || (allowSharedView && Boolean(updatedRow.access_can_view))
    || (allowSharedEdit && Boolean(updatedRow.access_can_edit));
  if (!canReturnUpdated) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  return mapSavedSearch(updatedRow);
}

export async function deleteOwnedSavedSearch(
  savedSearchId: number,
  ownerUserId: number
): Promise<void> {
  const pool = getDbPool();
  const result = await pool.query(
    `DELETE FROM saved_searches
     WHERE id = $1
       AND owner_user_id = $2`,
    [savedSearchId, ownerUserId]
  );

  if ((result.rowCount ?? 0) > 0) {
    return;
  }

  const existing = await pool.query(
    `SELECT owner_user_id FROM saved_searches WHERE id = $1 LIMIT 1`,
    [savedSearchId]
  );

  if ((existing.rowCount ?? 0) === 0) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  throw new Error("SAVED_SEARCH_FORBIDDEN");
}

function normalizeShareInput(input: SavedSearchShareRequest): SavedSearchShareRequest {
  return {
    username: input.username.trim(),
    canView: input.canView || input.canRun || input.canEdit,
    canRun: input.canRun,
    canEdit: input.canEdit,
  };
}

export async function shareSavedSearch(
  savedSearchId: number,
  ownerUserId: number,
  input: SavedSearchShareRequest
): Promise<SavedSearchShareRecord> {
  const pool = getDbPool();
  const normalized = normalizeShareInput(input);

  const savedSearchResult = await pool.query(
    `SELECT owner_user_id FROM saved_searches WHERE id = $1 LIMIT 1`,
    [savedSearchId]
  );
  if ((savedSearchResult.rowCount ?? 0) === 0) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  if (savedSearchResult.rows[0].owner_user_id !== ownerUserId) {
    throw new Error("SAVED_SEARCH_FORBIDDEN");
  }

  const userResult = await pool.query(
    `SELECT id, username FROM users WHERE username = $1 LIMIT 1`,
    [normalized.username]
  );
  if ((userResult.rowCount ?? 0) === 0) {
    throw new Error("TARGET_USER_NOT_FOUND");
  }

  const targetUser = userResult.rows[0] as { id: number; username: string };
  if (targetUser.id === ownerUserId) {
    throw new Error("TARGET_USER_INVALID");
  }

  const shareResult = await pool.query(
    `INSERT INTO saved_search_access (saved_search_id, user_id, can_view, can_run, can_edit)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (saved_search_id, user_id)
     DO UPDATE SET can_view = EXCLUDED.can_view,
                   can_run = EXCLUDED.can_run,
                   can_edit = EXCLUDED.can_edit
     RETURNING saved_search_id, user_id, can_view, can_run, can_edit, created_at`,
    [savedSearchId, targetUser.id, normalized.canView, normalized.canRun, normalized.canEdit]
  );

  await pool.query(
    `UPDATE saved_searches
     SET visibility = 'shared',
         updated_at = NOW()
     WHERE id = $1`,
    [savedSearchId]
  );

  return {
    savedSearchId: shareResult.rows[0].saved_search_id,
    userId: shareResult.rows[0].user_id,
    username: targetUser.username,
    canView: shareResult.rows[0].can_view,
    canRun: shareResult.rows[0].can_run,
    canEdit: shareResult.rows[0].can_edit,
    createdAt: shareResult.rows[0].created_at,
  };
}

export async function runSavedSearch(
  savedSearchId: number,
  userId: number,
  allowSharedView: boolean,
  allowSharedRun: boolean,
  source = "manual"
): Promise<{ savedSearch: SavedSearchRecord; run: SavedSearchRunRecord; results: ClinicalTrialStudiesResponse }> {
  const savedSearchRow = await getSavedSearchRow(savedSearchId, userId);
  if (!savedSearchRow) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  const isOwner = Boolean(savedSearchRow.is_owner);
  const canRunShared = !isOwner && allowSharedRun && Boolean(savedSearchRow.access_can_run);
  if (!isOwner && !canRunShared) {
    throw new Error("SAVED_SEARCH_FORBIDDEN");
  }

  const criteria = normalizeCriteriaForExecution(parseCriteriaJson(savedSearchRow.criteria_json) as RuntimeCriteria);
  const validation = validateSearchRequest(criteria);
  if (!validation.valid) {
    throw new Error(`SAVED_SEARCH_CRITERIA_INVALID:${JSON.stringify(validation.errors)}`);
  }

  const results = await searchClinicalTrials(criteria);
  const savedSearch = mapSavedSearch(savedSearchRow);

  const pool = getDbPool();
  const runResult = await pool.query(
    `INSERT INTO saved_search_runs (saved_search_id, run_by_user_id, source, result_count)
     VALUES ($1, $2, $3, $4)
     RETURNING id, saved_search_id, run_by_user_id, source, result_count, executed_at`,
    [savedSearchId, userId, source, results.totalCount]
  );

  const run = runResult.rows[0] as {
    id: number;
    saved_search_id: number;
    run_by_user_id: number;
    source: string;
    result_count: number;
    executed_at: string;
  };

  const snapshotStudies = results.studies.slice(0, 10);
  for (const [index, study] of snapshotStudies.entries()) {
    await pool.query(
      `INSERT INTO saved_search_snapshots (run_id, nct_id, rank_position, normalized_trial_json, raw_trial_json)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        run.id,
        study.protocolSection.identificationModule.nctId,
        index + 1,
        JSON.stringify(normalizeTrialStudy(study)),
        JSON.stringify(study),
      ]
    );
  }

  const canReturnSavedSearch = savedSearch.permissions.isOwner
    || (allowSharedView && savedSearch.permissions.canView)
    || (allowSharedRun && savedSearch.permissions.canRun);
  if (!canReturnSavedSearch) {
    throw new Error("SAVED_SEARCH_NOT_FOUND");
  }

  return {
    savedSearch,
    run: {
      id: run.id,
      savedSearchId: run.saved_search_id,
      runByUserId: run.run_by_user_id,
      source: run.source,
      resultCount: run.result_count,
      executedAt: run.executed_at,
      snapshotCount: snapshotStudies.length,
    },
    results,
  };
}
