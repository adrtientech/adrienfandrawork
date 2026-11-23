import dotenv from 'dotenv';
import { runSyncInboxAgent } from './agents/05-inbox-watcher.js';
import { runFollowupAgent } from './agents/06-followup.js';
import { runDiscoverAgent } from './agents/01-discovery.js';
import { runEnrichAgent } from './agents/02-enrichment.js';
import { runVerifierAgent } from './agents/03-verifier.js';
import { runOutreachAgent } from './agents/04-outreach.js';
import { supabaseServer, isServerSupabaseConfigured } from './supabase.js';

dotenv.config();

async function main() {
  console.log('==============================================================');
  console.log('🤖 [CRON RUNNER] Eksekusi Blueprint Otomasi 6-Tahap (A1 -> C2)');
  console.log(`⏰ Waktu Eksekusi: ${new Date().toISOString()}`);
  console.log('==============================================================\n');

  try {
    // 0. Cek Status Engine di Supabase (Apakah pengguna menyalakan "Engine Aktif")
    if (isServerSupabaseConfigured()) {
      const { data: settings } = await supabaseServer
        .from('settings')
        .select('is_global_paused')
        .eq('id', 1)
        .single();

      if (settings?.is_global_paused) {
        console.log('⏸️ [CRON RUNNER] Status: Engine Sedang Dijeda (is_global_paused = true).');
        console.log('💡 Tombol "Engine Aktif" belum dinyalakan di dashboard. Eksekusi dilewati.');
        process.exit(0);
      }
      console.log('▶️ [CRON RUNNER] Status: Engine Aktif! Melanjutkan eksekusi 6 staf AI otomatis...\n');
    }
    // 1. Tahap B3: Pemindaian Inbox Otomatis (05-inbox-watcher.ts)
    try {
      console.log('>>> [1/6 - Tahap B3] Menjalankan 05-inbox-watcher.ts (Echo)...');
      const syncRes = await runSyncInboxAgent();
      console.log(`✓ Hasil B3: ${syncRes.message}\n`);
    } catch (e: any) {
      console.warn(`⚠️ [Tahap B3] Error: ${e.message}\n`);
    }

    // 2. Tahap C1 & C2: Follow-Up Berjenjang & Jalur Alternatif (06-followup.ts)
    try {
      console.log('>>> [2/6 - Tahap C1-C2] Menjalankan 06-followup.ts (Nova)...');
      const fuRes = await runFollowupAgent();
      console.log(`✓ Hasil C1-C2: ${fuRes.message}\n`);
    } catch (e: any) {
      console.warn(`⚠️ [Tahap C1-C2] Error: ${e.message}\n`);
    }

    // 3. Tahap A1: Penemuan Brand Pintar & Deduplikasi Otomatis (01-discovery.ts)
    try {
      console.log('>>> [3/6 - Tahap A1] Menjalankan 01-discovery.ts (Atlas)...');
      const discRes = await runDiscoverAgent(4);
      console.log(`✓ Hasil A1: ${discRes.message}\n`);
    } catch (e: any) {
      console.warn(`⚠️ [Tahap A1] Error: ${e.message}\n`);
    }

    // 4. Tahap A2 & A3: Investigasi Web, Klasifikasi Skala, & Lacak Pemilik (02-enrichment.ts)
    try {
      console.log('>>> [4/6 - Tahap A2-A3] Menjalankan 02-enrichment.ts (Lyra)...');
      const enrichRes = await runEnrichAgent(4);
      console.log(`✓ Hasil A2-A3: ${enrichRes.message}\n`);
    } catch (e: any) {
      console.warn(`⚠️ [Tahap A2-A3] Error: ${e.message}\n`);
    }

    // 5. Tahap A4: Ekstraksi Kontak, Pisah Jalur WA, & Verifikasi Anti-Bounce (03-verifier.ts)
    try {
      console.log('>>> [5/6 - Tahap A4] Menjalankan 03-verifier.ts (Aegis - Bounce Shield)...');
      const verifyRes = await runVerifierAgent(4);
      console.log(`✓ Hasil A4: ${verifyRes.message}\n`);
    } catch (e: any) {
      console.warn(`⚠️ [Tahap A4] Error: ${e.message}\n`);
    }

    // 6. Tahap B1 & B2: Penulisan Hyper-Personalized & Pengiriman Zona Waktu (04-outreach.ts)
    try {
      console.log('>>> [6/6 - Tahap B1-B2] Menjalankan 04-outreach.ts (Orion - Timezone Sender)...');
      const outreachRes = await runOutreachAgent(3, { strictTimezoneWindow: true });
      console.log(`✓ Hasil B1-B2: ${outreachRes.message}\n`);
    } catch (e: any) {
      console.warn(`⚠️ [Tahap B1-B2] Error: ${e.message}\n`);
    }

    console.log('==============================================================');
    console.log('✅ [CRON RUNNER] Seluruh 6 Tahap Otomasi Selesai Dijalankan!');
    console.log('==============================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ [CRON RUNNER] Terjadi kesalahan fatal:', err.message);
    process.exit(1);
  }
}

main();
