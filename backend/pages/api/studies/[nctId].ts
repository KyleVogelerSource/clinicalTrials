import type { NextApiRequest, NextApiResponse } from 'next';
import { getStudyById } from '@/clinicalTrials/services/ClinicalTrialsApiClient';

type ResponseData = {
  data?: any;
  error?: string;
  message?: string;
};

/**
 * GET /api/studies/[nctId]
 * Fetch a specific study by NCT ID
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nctId } = req.query;

    if (!nctId || typeof nctId !== 'string') {
      return res.status(400).json({ error: 'NCT ID is required and must be a string' });
    }

    // Validate NCT ID format (should be NCT followed by 8 digits)
    if (!/^NCT\d{8}$/.test(nctId)) {
      return res.status(400).json({ error: 'Invalid NCT ID format. Expected NCT followed by 8 digits.' });
    }

    const result = await getStudyById(nctId);
    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error in /api/studies/[nctId]:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (message.includes('404')) {
      res.status(404).json({ error: 'Study not found', message });
    } else {
      res.status(500).json({ error: 'Failed to fetch study', message });
    }
  }
}
