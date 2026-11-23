import type { VercelRequest, VercelResponse } from '@vercel/node';
import pipelineHandler from '../cron/pipeline.js';

/**
 * Endpoint pemicu langsung dari Web UI Dashboard: /api/agents/run-all
 * Memungkinkan eksekusi instan 6 Agen AI langsung saat tombol di web diklik.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Izinkan akses CORS agar aman dipanggil dari frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return pipelineHandler(req, res);
}
