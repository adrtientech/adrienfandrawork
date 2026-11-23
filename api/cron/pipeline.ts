import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runDiscoverAgent } from '../../server/agents/01-discovery.js';
import { runEnrichAgent } from '../../server/agents/02-enrichment.js';
import { runVerifierAgent } from '../../server/agents/03-verifier.js';
import { runOutreachAgent } from '../../server/agents/04-outreach.js';
import { runSyncInboxAgent } from '../../server/agents/05-inbox-watcher.js';
import { runFollowupAgent } from '../../server/agents/06-followup.js';
import { supabaseServer, isServerSupabaseConfigured } from '../../server/supabase.js';

/**
 * Vercel Cron Job Handler: /api/cron/pipeline
 * Berjalan otomatis di cloud Vercel 24/7 (bahkan saat laptop mati)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Verifikasi Cron Secret (Opsi Keamanan Vercel)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized cron trigger' });
  }

  // 2. Cek apakah Engine sedang dijeda oleh pengguna di Supabase
  if (isServerSupabaseConfigured()) {
    const { data: settings } = await supabaseServer.from('settings').select('is_global_paused').eq('id', 1).single();
    if (settings?.is_global_paused) {
      return res.status(200).json({
        success: true,
        message: 'Engine sedang dijeda secara global oleh Adrien. Cron dilewati.',
      });
    }
  }

  console.log(`[Vercel Cron 24/7] Menjalankan Pipeline Otomasi: ${new Date().toISOString()}`);

  try {
    // Jalankan pipeline bertahap
    const syncInbox = await runSyncInboxAgent();
    const followup = await runFollowupAgent();
    const discovery = await runDiscoverAgent(3);
    const enrichment = await runEnrichAgent(3);
    const verifier = await runVerifierAgent(3);
    
    // SAFE MODE: Outreach hanya di-draft atau dikirim ke akun uji coba
    const outreach = await runOutreachAgent(2, { strictTimezoneWindow: true });

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        syncInbox: syncInbox.message,
        followup: followup.message,
        discovery: discovery.message,
        enrichment: enrichment.message,
        verifier: verifier.message,
        outreach: outreach.message,
      },
    });
  } catch (err: any) {
    console.error('[Vercel Cron Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Cron execution failed' });
  }
}
