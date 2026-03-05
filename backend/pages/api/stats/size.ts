import type { NextApiRequest, NextApiResponse } from 'next';
import { getStatsSize } from '@/clinicalTrials/services/ClinicalTrialsApiClient';

type ResponseData = {
  data?: any;
  error?: string;
  message?: string;
};

/**
 * GET /api/stats/size
 * Get statistics about total number of studies
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await getStatsSize();
    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error in /api/stats/size:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to fetch stats', message });
  }
}
