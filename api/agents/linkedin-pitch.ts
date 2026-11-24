import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateLinkedInPitch } from '../../server/agents/06-linkedin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const {
      brandId,
      companyName,
      domain,
      productSummary,
      founderName,
      primaryPicName,
      primaryPicRole,
      founderLinkedinUrl,
      companyLinkedinUrl,
      nicheCategory,
      country,
      customAngle,
    } = req.body || {};

    if (!companyName) {
      return res.status(400).json({ success: false, message: 'Nama perusahaan (companyName) wajib diisi.' });
    }

    const result = await generateLinkedInPitch({
      brandId,
      companyName,
      domain,
      productSummary,
      founderName,
      primaryPicName,
      primaryPicRole,
      founderLinkedinUrl,
      companyLinkedinUrl,
      nicheCategory,
      country,
      customAngle,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[Vercel LinkedIn Pitch Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal memproses draf LinkedIn via Nova AI.',
    });
  }
}
