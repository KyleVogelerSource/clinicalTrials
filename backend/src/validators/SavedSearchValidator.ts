import { SavedSearchShareRequest, SavedSearchUpsertRequest, SavedSearchVisibility } from "../dto/SavedSearchDto";
import { ValidationError, ValidationResult, validateSearchRequest } from "./ClinicalTrialSearchValidator";

const VALID_VISIBILITY_VALUES: SavedSearchVisibility[] = ["private", "shared"];

export function validateSavedSearchUpsertRequest(req: Partial<SavedSearchUpsertRequest>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!req.name?.trim()) {
    errors.push({ field: "name", message: "name is required." });
  } else if (req.name.trim().length > 200) {
    errors.push({ field: "name", message: "name cannot exceed 200 characters." });
  }

  if (req.description !== undefined && req.description !== null && typeof req.description !== "string") {
    errors.push({ field: "description", message: "description must be a string when provided." });
  }

  if (!req.visibility || !VALID_VISIBILITY_VALUES.includes(req.visibility)) {
    errors.push({ field: "visibility", message: "visibility must be either 'private' or 'shared'." });
  }

  if (!req.criteriaJson || typeof req.criteriaJson !== "object" || Array.isArray(req.criteriaJson)) {
    errors.push({ field: "criteriaJson", message: "criteriaJson is required and must be an object." });
  } else {
    const searchValidation = validateSearchRequest(req.criteriaJson);
    errors.push(
      ...searchValidation.errors.map((error) => ({
        field: `criteriaJson.${error.field}`,
        message: error.message,
      }))
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateSavedSearchShareRequest(req: Partial<SavedSearchShareRequest>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!req.username?.trim()) {
    errors.push({ field: "username", message: "username is required." });
  }

  const booleanFields: Array<keyof SavedSearchShareRequest> = ["canView", "canRun", "canEdit"];
  for (const field of booleanFields) {
    if (typeof req[field] !== "boolean") {
      errors.push({ field, message: `${field} must be a boolean.` });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}