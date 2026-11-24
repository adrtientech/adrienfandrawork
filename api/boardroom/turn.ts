import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateBoardroomTurn } from '../../server/agents/07-boardroom.js';

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
    const { agenda, history, bossInput, requestedSpeaker, action } = req.body || {};
    const result = await generateBoardroomTurn({
      agenda: agenda || 'Evaluasi Kinerja Mingguan & Strategi Dealflow',
      history: history || [],
      bossInput,
      requestedSpeaker,
      action: action || (bossInput ? 'boss_interrupt' : 'next'),
    });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Vercel Boardroom Turn Error]:', err);
    return res.status(500).json({ success: false, message: err.message || 'Gagal memproses giliran rapat.' });
  }
}
