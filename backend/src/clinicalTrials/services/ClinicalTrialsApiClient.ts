// Clinical Trials API Client Utility
import { 
  StudiesListResponse, 
  StudiesResponse,
  FullStudyRecord
} from '../models/StudyModels';
import { ClinicalTrialSearchRequest } from '../dto/ClinicalTrialSearchRequest';
import Logger from '../../utils/Logger';

const BASE_URL = 'https://clinicaltrials.gov/api/v2';
const logger = new Logger('ClinicalTrialsApiClient', {
  enableFileLogging: true,
  enableConsoleLogging: true,
});

export interface ApiError {
  message: string;
  status: number;
  error?: any;
}

/**
 * Fetch a list of studies with search/filter parameters
 */
export async function getStudies(params: {
  query?: string;
  pageSize?: number;
  pageToken?: string;
  countTotal?: boolean;
  sort?: string;
  filter?: Record<string, any>;
}): Promise<StudiesListResponse> {
  const startTime = Date.now();
  const timer = logger.startTimer();

  try {
    const queryParams = new URLSearchParams();
    
    // Log input parameters
    logger.debug('getStudies called', {
      queryProvided: !!params.query,
      pageSize: params.pageSize,
      hasFilters: !!(params.filter && Object.keys(params.filter).length > 0),
      filterCount: params.filter ? Object.keys(params.filter).length : 0,
    });

    // Only add query parameter if it's not empty
    if (params.query && params.query.trim() !== '') {
      queryParams.append('query.term', params.query);
      logger.debug('Added query.term parameter', { query: params.query });
    }
    if (params.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params.pageToken) {
      queryParams.append('pageToken', params.pageToken);
      logger.debug('Pagination token provided', { hasToken: true });
    }
    if (params.countTotal !== undefined) {
      queryParams.append('countTotal', params.countTotal.toString());
    }
    if (params.sort) {
      queryParams.append('sort', params.sort);
    }
    
    // Add filter parameters
    if (params.filter) {
      Object.entries(params.filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(`filter.${key}`, String(value));
          logger.debug(`Added filter parameter: ${key}`, { value });
        }
      });
    }

    const url = `${BASE_URL}/studies?${queryParams.toString()}`;
    logger.info('Calling ClinicalTrials API', {
      url: url.substring(0, 150), // Truncate for readability
      method: 'GET',
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const duration = timer();

    if (!response.ok) {
      logger.error('API returned error status', 
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        {
          method: 'GET',
          url: url.substring(0, 150),
          statusCode: response.status,
          statusText: response.statusText,
          duration,
        }
      );
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const finalDuration = Date.now() - startTime;

    logger.logApiCall({
      method: 'GET',
      url: url.substring(0, 150),
      responseStatus: response.status,
      duration: finalDuration,
      success: true,
      responseBody: data.studies ? `${data.studies.length} studies` : 'no studies',
    });

    logger.info('getStudies succeeded', {
      studiesReturned: data.studies?.length || 0,
      totalCount: data.totalCount,
      duration: finalDuration,
      hasNextToken: !!data.nextPageToken,
    });

    return data as StudiesListResponse;
  } catch (error) {
    const duration = timer();
    logger.error('getStudies failed', error, {
      duration,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw handleError('getStudies', error);
  }
}

/**
 * Fetch a specific study by NCT ID
 */
export async function getStudyById(nctId: string): Promise<FullStudyRecord> {
  try {
    const url = `${BASE_URL}/studies/${nctId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as FullStudyRecord;
  } catch (error) {
    throw handleError('getStudyById', error);
  }
}

/**
 * Get metadata information about available search parameters
 */
export async function getStudiesMetadata(): Promise<any> {
  try {
    const url = `${BASE_URL}/studies/metadata`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getStudiesMetadata', error);
  }
}

/**
 * Get available search areas
 */
export async function getSearchAreas(): Promise<any> {
  try {
    const url = `${BASE_URL}/studies/search-areas`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getSearchAreas', error);
  }
}

/**
 * Get enum values for various fields
 */
export async function getEnums(): Promise<any> {
  try {
    const url = `${BASE_URL}/studies/enums`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getEnums', error);
  }
}

/**
 * Get statistics about total number of studies
 */
export async function getStatsSize(): Promise<any> {
  try {
    const url = `${BASE_URL}/stats/size`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getStatsSize', error);
  }
}

/**
 * Get statistics about specific field values
 */
export async function getStatsFieldValues(params: {
  fields: string[];
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  try {
    const queryParams = new URLSearchParams();
    params.fields.forEach(field => {
      queryParams.append('fields', field);
    });
    if (params.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params.pageToken) {
      queryParams.append('pageToken', params.pageToken);
    }

    const url = `${BASE_URL}/stats/field/values?${queryParams.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getStatsFieldValues', error);
  }
}

/**
 * Get statistics about field sizes
 */
export async function getStatsFieldSizes(params: {
  fields: string[];
  pageSize?: number;
  pageToken?: string;
}): Promise<any> {
  try {
    const queryParams = new URLSearchParams();
    params.fields.forEach(field => {
      queryParams.append('fields', field);
    });
    if (params.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }
    if (params.pageToken) {
      queryParams.append('pageToken', params.pageToken);
    }

    const url = `${BASE_URL}/stats/field/sizes?${queryParams.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getStatsFieldSizes', error);
  }
}

/**
 * Get API version information
 */
export async function getVersion(): Promise<any> {
  try {
    const url = `${BASE_URL}/version`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw handleError('getVersion', error);
  }
}

/**
 * Utility function to handle errors consistently
 */
function handleError(functionName: string, error: any): ApiError {
  const message = error instanceof Error ? error.message : String(error);
  
  logger.error(`${functionName} request failed`, error, {
    function: functionName,
    errorMessage: message,
    errorType: error?.constructor?.name,
  });
  
  return {
    message: `Failed to fetch from Clinical Trials API: ${message}`,
    status: 500,
    error,
  };
}

/**
 * Construct a query string from ClinicalTrialSearchRequest
 */
export function buildQueryFromSearchRequest(request: ClinicalTrialSearchRequest): string {
  const conditions: string[] = [];

  if (request.term) conditions.push(`SEARCH(${request.term})`);
  if (request.condition) conditions.push(`CONDITION("${request.condition}")`);
  if (request.intervention) conditions.push(`INTERVENTION("${request.intervention}")`);
  if (request.sponsor) conditions.push(`SPONSOR("${request.sponsor}")`);
  if (request.investigator) conditions.push(`INVESTIGATOR("${request.investigator}")`);
  if (request.location) conditions.push(`LOCATION("${request.location}")`);

  return conditions.join(' AND ');
}

/**
 * Build filter object from ClinicalTrialSearchRequest
 * NOTE: ClinicalTrials.gov API v2 only supports a limited set of filters
 * Age, sex, and study type filters must be included in the query, not as separate filters
 */
export function buildFilterFromSearchRequest(request: ClinicalTrialSearchRequest): Record<string, any> {
  const filter: Record<string, any> = {};

  // Only add filters that are actually supported by the ClinicalTrials.gov API v2
  if (request.overallStatus) filter.overallStatus = request.overallStatus;
  
  // Note: The following are NOT supported as filter parameters:
  // - minAge, maxAge (age-related filters not in ClinicalTrials.gov API v2)
  // - sex (not in ClinicalTrials.gov API v2)
  // - studyType (not in ClinicalTrials.gov API v2)
  // These would need to be part of the query string if supported at all

  return filter;
}
