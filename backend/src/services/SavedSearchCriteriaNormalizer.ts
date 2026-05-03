import { createHash } from "crypto";
import { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonArrayItem = string | number | boolean;

const LOWERCASE_FIELDS = new Set([
  "term",
  "condition",
  "intervention",
  "sponsor",
  "investigator",
  "location",
  "overallStatus",
  "studyType",
  "phase",
  "allocationType",
  "interventionModel",
  "blindingType",
  "primaryPurpose",
  "sex",
]);

function normalizeScalar(key: string, value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null;
    }

    return LOWERCASE_FIELDS.has(key) ? trimmed.toLowerCase() : trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function normalizeArray(key: string, value: unknown[]): JsonValue[] {
  const normalized = value
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed === "") {
          return undefined;
        }

        return LOWERCASE_FIELDS.has(key) ? trimmed.toLowerCase() : trimmed;
      }

      if (typeof item === "number" || typeof item === "boolean") {
        return item;
      }

      return undefined;
    })
    .filter((item): item is JsonArrayItem => item !== undefined);

  return [...normalized].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function stableSortObject(input: Record<string, JsonValue>): Record<string, JsonValue> {
  return Object.keys(input)
    .sort()
    .reduce<Record<string, JsonValue>>((accumulator, key) => {
      accumulator[key] = input[key];
      return accumulator;
    }, {});
}

export function normalizeSavedSearchCriteria(
  criteria: ClinicalTrialSearchRequest
): Record<string, JsonValue> {
  const normalizedEntries = Object.entries(criteria).reduce<Record<string, JsonValue>>(
    (accumulator, [key, value]) => {
      if (value === undefined) {
        return accumulator;
      }

      if (Array.isArray(value)) {
        const normalizedArray = normalizeArray(key, value);
        if (normalizedArray.length > 0) {
          accumulator[key] = normalizedArray;
        }
        return accumulator;
      }

      const normalizedValue = normalizeScalar(key, value);
      if (normalizedValue !== undefined && normalizedValue !== null) {
        accumulator[key] = normalizedValue;
      }

      return accumulator;
    },
    {}
  );

  return stableSortObject(normalizedEntries);
}

export function toStableCriteriaJson(criteria: ClinicalTrialSearchRequest): string {
  return JSON.stringify(normalizeSavedSearchCriteria(criteria));
}

export function buildSavedSearchCanonicalKey(criteria: ClinicalTrialSearchRequest): string {
  return createHash("sha256").update(toStableCriteriaJson(criteria)).digest("hex");
}
