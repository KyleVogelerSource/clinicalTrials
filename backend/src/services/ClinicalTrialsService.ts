import { ClinicalTrialSearchRequest } from "../../../shared/src/dto/ClinicalTrialSearchRequest";
import { ClinicalTrialsApiClient } from "../client/ClinicalTrialsApiClient";
import { ClinicalTrialStudiesResponse } from "../models/ClinicalTrialStudiesResponse";

const defaultClient = new ClinicalTrialsApiClient();

export async function searchClinicalTrials(request: ClinicalTrialSearchRequest,client: ClinicalTrialsApiClient = defaultClient): Promise<ClinicalTrialStudiesResponse> {
  return client.searchStudies(request);
}

export function createEmptyClinicalTrialStudiesResponse(): ClinicalTrialStudiesResponse {
  return {
    totalCount: 0,
    studies: [],
  };
}