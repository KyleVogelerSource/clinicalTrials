import { SavedSearchRecord, SavedSearchUpsertRequest } from "./saved-search.service";

interface SavedSearchFileEnvelope {
  format?: string;
  version?: number;
  searches?: unknown;
  criteria?: unknown;
}

function isSavedSearchArray(value: unknown): value is SavedSearchUpsertRequest[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildImportedSearchName(criteria: Record<string, unknown>): string {
  const condition = typeof criteria["condition"] === "string" ? criteria["condition"].trim() : "";
  const phase = typeof criteria["phase"] === "string" ? criteria["phase"].trim() : "";

  if (condition && phase) {
    return `${condition} (${phase})`;
  }

  if (condition) {
    return condition;
  }

  return "Imported Search";
}

export function buildSavedSearchesExportJson(records: SavedSearchRecord[]): string {
  return JSON.stringify(
    {
      format: "clinicaltrials-saved-searches",
      version: 1,
      searches: records.map((record) => ({
        name: record.name,
        description: record.description,
        criteriaJson: record.criteriaJson,
        visibility: record.visibility,
      })),
    },
    null,
    2
  );
}

export function parseSavedSearchesImportJson(content: string): SavedSearchUpsertRequest[] {
  const parsed = JSON.parse(content) as SavedSearchFileEnvelope | SavedSearchUpsertRequest[];
  if ((parsed as SavedSearchFileEnvelope).format === "clinicaltrials-designer-criteria") {
    const criteria = (parsed as SavedSearchFileEnvelope).criteria;
    if (!isRecord(criteria)) {
      throw new Error("Designer criteria import requires a criteria object.");
    }

    return [
      {
        name: buildImportedSearchName(criteria),
        description: "Imported from designer criteria",
        criteriaJson: criteria,
        visibility: "private",
      },
    ];
  }

  const searches = isSavedSearchArray((parsed as SavedSearchFileEnvelope).searches)
    ? (parsed as SavedSearchFileEnvelope).searches
    : parsed;

  if (!Array.isArray(searches) || searches.length === 0) {
    throw new Error("Saved search import requires a non-empty searches array.");
  }

  return searches.map((search) => {
    if (!search?.name || !search.criteriaJson || !search.visibility) {
      throw new Error("Each imported saved search must include name, criteriaJson, and visibility.");
    }

    return {
      name: String(search.name),
      description: search.description == null ? null : String(search.description),
      criteriaJson: search.criteriaJson,
      visibility: search.visibility,
    } satisfies SavedSearchUpsertRequest;
  });
}
