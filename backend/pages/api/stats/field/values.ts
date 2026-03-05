import type { NextApiRequest, NextApiResponse } from 'next';
import { getStatsFieldValues } from '@/clinicalTrials/services/ClinicalTrialsApiClient';

type ResponseData = {
  data?: any;
  error?: string;
  message?: string;
};

/**
 * GET /api/stats/field/values
 * Get statistics about specific field values
 * 
 * Query Parameters:
 * - fields: string or string[] (field names, e.g., "Status", "StudyType")
 * - pageSize: number (optional)
 * - pageToken: string (optional)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, pageSize, pageToken } = req.query;

    if (!fields) {
      return res.status(400).json({ error: 'fields parameter is required' });
    }

    // Convert fields to array if it's a string
    const fieldArray = Array.isArray(fields) ? fields : [fields as string];

    const result = await getStatsFieldValues({
      fields: fieldArray,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      pageToken: pageToken as string | undefined,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error in /api/stats/field/values:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: 'Failed to fetch field values', message });
  }
}
