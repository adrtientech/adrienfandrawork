import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runManagerChat } from '../../server/agents/06-manager-chat.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
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
    const { messages, message } = req.body || {};
    const history = messages || [];
    const latestUserMessage = message || (history.length > 0 ? history[history.length - 1].content : '');

    if (!latestUserMessage) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong.' });
    }

    const result = await runManagerChat(history, latestUserMessage);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Vercel Manager Chat Error]:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Gagal memproses percakapan dengan AI Manager.',
    });
  }
}
