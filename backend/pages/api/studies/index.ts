import type { NextApiRequest, NextApiResponse } from 'next';
import { getStudies, buildQueryFromSearchRequest, buildFilterFromSearchRequest } from '@/clinicalTrials/services/ClinicalTrialsApiClient';
import { ClinicalTrialSearchRequest } from '@/clinicalTrials/dto/ClinicalTrialSearchRequest';

type ResponseData = any;

/**
 * GET /api/studies
 * Search for clinical trials with optional filters
 * 
 * Query Parameters:
 * - query: string (raw query string, e.g., "CONDITION(diabetes)")
 * - term: string (search term)
 * - condition: string (condition filter)
 * - intervention: string (intervention filter)
 * - sponsor: string (sponsor filter)
 * - investigator: string (investigator filter)
 * - location: string (location filter)
 * - overallStatus: string (status filter)
 * - studyType: string (study type filter)
 * - phase: string (phase filter)
 * - interventionModel: string (intervention model filter)
 * - primaryPurpose: string (primary purpose filter)
 * - sex: string (sex/gender filter)
 * - minAge: number
 * - maxAge: number
 * - healthyVolunteers: boolean
 * - startDateFrom: string (YYYY-MM-DD)
 * - startDateTo: string (YYYY-MM-DD)
 * - completionDateFrom: string (YYYY-MM-DD)
 * - completionDateTo: string (YYYY-MM-DD)
 * - minEnrollment: number
 * - maxEnrollment: number
 * - hasResults: boolean
 * - pageSize: number (default varies by API, max 100)
 * - pageToken: string
 * - countTotal: boolean
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract query parameters
    const {
      query,
      pageSize,
      pageToken,
      countTotal,
      sort,
      // Search filters
      term,
      condition,
      intervention,
      sponsor,
      investigator,
      location,
      // Status/Type filters
      overallStatus,
      studyType,
      phase,
      interventionModel,
      primaryPurpose,
      sex,
      minAge,
      maxAge,
      healthyVolunteers,
      startDateFrom,
      startDateTo,
      completionDateFrom,
      completionDateTo,
      minEnrollment,
      maxEnrollment,
      hasResults,
    } = req.query;

    // Build search request object for convenience
    const searchRequest: ClinicalTrialSearchRequest = {
      term: term as string | undefined,
      condition: condition as string | undefined,
      intervention: intervention as string | undefined,
      sponsor: sponsor as string | undefined,
      investigator: investigator as string | undefined,
      location: location as string | undefined,
      overallStatus: overallStatus as string | undefined,
      studyType: studyType as string | undefined,
      phase: phase as string | undefined,
      interventionModel: interventionModel as string | undefined,
      primaryPurpose: primaryPurpose as string | undefined,
      sex: sex as string | undefined,
      minAge: minAge ? parseInt(minAge as string) : undefined,
      maxAge: maxAge ? parseInt(maxAge as string) : undefined,
      healthyVolunteers: healthyVolunteers ? healthyVolunteers === 'true' : undefined,
      startDateFrom: startDateFrom as string | undefined,
      startDateTo: startDateTo as string | undefined,
      completionDateFrom: completionDateFrom as string | undefined,
      completionDateTo: completionDateTo as string | undefined,
      minEnrollment: minEnrollment ? parseInt(minEnrollment as string) : undefined,
      maxEnrollment: maxEnrollment ? parseInt(maxEnrollment as string) : undefined,
      hasResults: hasResults ? hasResults === 'true' : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      pageToken: pageToken as string | undefined,
      countTotal: countTotal ? countTotal === 'true' : undefined,
    };

    // Determine query string - use provided query or build from search request
    let finalQuery = query as string | undefined;
    if (!finalQuery && Object.values(searchRequest).some(v => v !== undefined)) {
      finalQuery = buildQueryFromSearchRequest(searchRequest);
    }

    // Call the API
    const result = await getStudies({
      query: finalQuery,
      pageSize: searchRequest.pageSize,
      pageToken: searchRequest.pageToken,
      countTotal: searchRequest.countTotal,
      sort: sort as string | undefined,
      filter: buildFilterFromSearchRequest(searchRequest),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /api/studies:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to fetch studies', message });
  }
}
