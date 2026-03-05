import type { NextApiRequest, NextApiResponse } from 'next'

type ResponseData = {
  message: string
  timestamp: string
  uptime?: number
  version?: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0'
  })
}
