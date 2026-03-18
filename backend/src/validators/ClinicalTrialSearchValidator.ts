import { ClinicalTrialSearchRequest } from "../../shared/src/dto/ClinicalTrialSearchRequest";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Fields that count as "at least one search term provided"
const QUERY_FIELDS: (keyof ClinicalTrialSearchRequest)[] = [
  "term",
  "condition",
  "intervention",
  "sponsor",
  "investigator",
  "location",
];

const DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const MAX_PAGE_SIZE = 100;

export function validateSearchRequest(
  req: ClinicalTrialSearchRequest
): ValidationResult {
  const errors: ValidationError[] = [];

  // ── Require at least one query term ────────────────────────────────────────
  const hasQuery = QUERY_FIELDS.some(
    (f) => req[f] !== undefined && String(req[f]).trim() !== ""
  );
  if (!hasQuery) {
    errors.push({
      field: QUERY_FIELDS.join(" | "),
      message:
        "At least one search term is required: term, condition, intervention, sponsor, investigator, or location.",
    });
  }

  // ── Pagination constraints ──────────────────────────────────────────────────
  if (req.pageSize !== undefined) {
    if (!Number.isInteger(req.pageSize) || req.pageSize < 1) {
      errors.push({ field: "pageSize", message: "pageSize must be a positive integer." });
    } else if (req.pageSize > MAX_PAGE_SIZE) {
      errors.push({
        field: "pageSize",
        message: `pageSize cannot exceed ${MAX_PAGE_SIZE}.`,
      });
    }
  }

  // ── Age constraints ─────────────────────────────────────────────────────────
  if (req.minAge !== undefined) {
    if (!Number.isInteger(req.minAge) || req.minAge < 0) {
      errors.push({ field: "minAge", message: "minAge must be a non-negative integer." });
    }
  }
  if (req.maxAge !== undefined) {
    if (!Number.isInteger(req.maxAge) || req.maxAge < 0) {
      errors.push({ field: "maxAge", message: "maxAge must be a non-negative integer." });
    }
  }
  if (
    req.minAge !== undefined &&
    req.maxAge !== undefined &&
    req.minAge > req.maxAge
  ) {
    errors.push({ field: "minAge / maxAge", message: "minAge cannot be greater than maxAge." });
  }

  // ── Enrollment constraints ──────────────────────────────────────────────────
  if (req.minEnrollment !== undefined) {
    if (!Number.isInteger(req.minEnrollment) || req.minEnrollment < 0) {
      errors.push({
        field: "minEnrollment",
        message: "minEnrollment must be a non-negative integer.",
      });
    }
  }
  if (req.maxEnrollment !== undefined) {
    if (!Number.isInteger(req.maxEnrollment) || req.maxEnrollment < 0) {
      errors.push({
        field: "maxEnrollment",
        message: "maxEnrollment must be a non-negative integer.",
      });
    }
  }
  if (
    req.minEnrollment !== undefined &&
    req.maxEnrollment !== undefined &&
    req.minEnrollment > req.maxEnrollment
  ) {
    errors.push({
      field: "minEnrollment / maxEnrollment",
      message: "minEnrollment cannot be greater than maxEnrollment.",
    });
  }

  // ── Date format validation ──────────────────────────────────────────────────
  const dateFields: (keyof ClinicalTrialSearchRequest)[] = [
    "startDateFrom",
    "startDateTo",
    "completionDateFrom",
    "completionDateTo",
  ];
  for (const field of dateFields) {
    const value = req[field];
    if (value !== undefined && typeof value === "string" && !DATE_PATTERN.test(value)) {
      errors.push({
        field,
        message: `${field} must match YYYY, YYYY-MM, or YYYY-MM-DD format.`,
      });
    }
  }

  // ── Date range ordering ─────────────────────────────────────────────────────
  if (req.startDateFrom && req.startDateTo && req.startDateFrom > req.startDateTo) {
    errors.push({
      field: "startDateFrom / startDateTo",
      message: "startDateFrom cannot be after startDateTo.",
    });
  }
  if (
    req.completionDateFrom &&
    req.completionDateTo &&
    req.completionDateFrom > req.completionDateTo
  ) {
    errors.push({
      field: "completionDateFrom / completionDateTo",
      message: "completionDateFrom cannot be after completionDateTo.",
    });
  }

  return { valid: errors.length === 0, errors };
}
