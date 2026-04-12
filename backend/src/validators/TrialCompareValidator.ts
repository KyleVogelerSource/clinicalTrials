import { TrialCompareRequest } from "../dto/TrialCompareDto";
import { ValidationError, ValidationResult } from "./ClinicalTrialSearchValidator";

const WEIGHT_FIELDS: Array<keyof NonNullable<TrialCompareRequest["weights"]>> = [
  "conditionOverlap",
  "phaseMatch",
  "studyType",
  "eligibilityCompatibility",
  "interventionOverlap",
  "enrollmentSimilarity",
  "statusRecency",
];

export function validateTrialCompareRequest(req: Partial<TrialCompareRequest>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(req.trials)) {
    errors.push({ field: "trials", message: "trials must be an array." });
  } else {
    if (req.trials.length < 2 || req.trials.length > 5) {
      errors.push({ field: "trials", message: "trials must include between 2 and 5 items." });
    }

    req.trials.forEach((trial, index) => {
      if (!trial || typeof trial.nctId !== "string" || trial.nctId.trim() === "") {
        errors.push({ field: `trials[${index}].nctId`, message: "nctId is required." });
      }
    });
  }

  if (req.weights !== undefined) {
    if (!req.weights || typeof req.weights !== "object" || Array.isArray(req.weights)) {
      errors.push({ field: "weights", message: "weights must be an object when provided." });
    } else {
      for (const field of WEIGHT_FIELDS) {
        const value = req.weights[field];
        if (value !== undefined && (typeof value !== "number" || Number.isNaN(value) || value < 0)) {
          errors.push({ field: `weights.${field}`, message: `${field} must be a non-negative number.` });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
