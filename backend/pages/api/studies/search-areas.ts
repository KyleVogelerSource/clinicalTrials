import type { NextApiRequest, NextApiResponse } from 'next';
import { getSearchAreas } from '@/clinicalTrials/services/ClinicalTrialsApiClient';

type ResponseData = {
  data?: any;
  error?: string;
  message?: string;
};

/**
 * GET /api/studies/search-areas
 * Get available search areas for filtering
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await getSearchAreas();
    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error in /api/studies/search-areas:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to fetch search areas', message });
  }
}
