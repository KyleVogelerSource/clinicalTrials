import { ClinicalTrialStudiesResponse } from "../models/ClinicalTrialStudiesResponse";

export function createEmptyClinicalTrialStudiesResponse(): ClinicalTrialStudiesResponse {
  return {
    totalCount: 0,
    studies: [],
  };
}