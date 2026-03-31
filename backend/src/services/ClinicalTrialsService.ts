import { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";
import { ClinicalTrialsApiClient } from "../client/ClinicalTrialsApiClient";
import { ClinicalTrialStudiesResponse, ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { buildCandidatePool, PoolBuilderConfig } from "./CandidatePoolBuilder";
import { CandidatePool } from "../models/NormalizedTrial";

const defaultClient = new ClinicalTrialsApiClient();
const MAX_PAGES = 10;

export async function searchClinicalTrials(request: ClinicalTrialSearchRequest, client: ClinicalTrialsApiClient = defaultClient): Promise<ClinicalTrialStudiesResponse> {
  return client.searchStudies(request);
}

export function createEmptyClinicalTrialStudiesResponse(): ClinicalTrialStudiesResponse {
  return {
    totalCount: 0,
    studies: [],
  };
}

export async function searchAndBuildCandidatePool(request: ClinicalTrialSearchRequest, poolConfig: PoolBuilderConfig = {}, client: ClinicalTrialsApiClient = defaultClient): Promise<CandidatePool> {
  const { allStudies, totalPagesFetched } = await fetchAllPages(request, client);
  return buildCandidatePool(allStudies, totalPagesFetched, poolConfig);
}

async function fetchAllPages(request: ClinicalTrialSearchRequest, client: ClinicalTrialsApiClient): Promise<{ allStudies: ClinicalTrialStudy[]; totalPagesFetched: number }> {
  const allStudies: ClinicalTrialStudy[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;

  do {
    const response = await client.searchStudies({
      ...request,
      pageSize: 100,
      pageToken,
    });

    allStudies.push(...response.studies);
    pagesFetched++;
    pageToken = response.nextPageToken;

    console.log(`[ClinicalTrialsService] Fetched page ${pagesFetched} — ${response.studies.length} studies, nextPageToken: ${pageToken ?? "none"}`);
  } while (pageToken && pagesFetched < MAX_PAGES);

  if (pageToken && pagesFetched >= MAX_PAGES) {
    console.warn(`[ClinicalTrialsService] Reached MAX_PAGES (${MAX_PAGES}) — ${allStudies.length} studies fetched, further pages skipped.`);
  }

  return { allStudies, totalPagesFetched: pagesFetched };
}