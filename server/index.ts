import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { isServerSupabaseConfigured } from './supabase.js';
import { isGmailConfigured } from './gmail-client.js';
import { runDiscoverAgent } from './agents/01-discovery.js';
import { runEnrichAgent } from './agents/02-enrichment.js';
import { runVerifierAgent } from './agents/03-verifier.js';
import { runOutreachAgent } from './agents/04-outreach.js';
import { runSyncInboxAgent } from './agents/05-inbox-watcher.js';
import { runFollowupAgent } from './agents/06-followup.js';
import { runManagerChat, getStoredChatHistory, resetStoredChatHistory } from './agents/06-manager-chat.js';
import { getExcludedBrands, addExcludedBrand, removeExcludedBrand } from './excluded-brands.js';
import { getVaultDocuments, addVaultDocument, removeVaultDocument } from './vault.js';
import { supabaseServer } from './supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// Health check endpoint (termasuk status 4 Pengaman Teknis)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: isServerSupabaseConfigured(),
      gemini: !!process.env.GEMINI_API_KEY,
      serper: !!process.env.SERPER_API_KEY,
      gmail: isGmailConfigured(),
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      verifalia: !!(process.env.VERIFALIA_USERNAME && process.env.VERIFALIA_PASSWORD),
      bounceShieldDnsMx: true,
      timezoneAwareSending: true,
      safeTestMode: process.env.SAFE_TEST_MODE === 'true',
    },
  });
});

// Endpoint untuk mendapatkan URL Autentikasi Gmail
app.get('/api/gmail/auth-url', (req, res) => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      message: 'GMAIL_CLIENT_ID atau GMAIL_CLIENT_SECRET belum ada di file .env',
    });
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3001/oauth2callback'
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    prompt: 'consent',
  });

  res.json({ success: true, authUrl });
});

// 1. Tahap A1: Penemuan Brand Pintar & Deduplikasi Otomatis (01-discovery.ts - Atlas)
app.post('/api/agents/discover', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 5;
    const result = await runDiscoverAgent(limit);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/agents/discover:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 2. Tahap A2 & A3: Investigasi Web, Klasifikasi Skala, Lacak Pemilik, & AI Lead Scoring (02-enrichment.ts - Lyra)
app.post('/api/agents/enrich', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 3;
    const autoVerify = req.body?.autoVerify !== false;
    const enrichResult = await runEnrichAgent(limit);

    // Otomatis lanjutkan ke Tahap A4 (03-verifier.ts) jika autoVerify aktif
    let verifyResult = null;
    if (autoVerify && enrichResult.enrichedCount > 0) {
      verifyResult = await runVerifierAgent(limit);
    }

    res.json({
      ...enrichResult,
      verifyResult,
      message: verifyResult
        ? `${enrichResult.message} | ${verifyResult.message}`
        : enrichResult.message,
    });
  } catch (err: any) {
    console.error('Error in /api/agents/enrich:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 3. Tahap A4: Ekstraksi Kontak, Pisah Jalur Telepon/WA, & Verifikasi Anti-Bounce (03-verifier.ts - Aegis)
app.post('/api/agents/verify', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 4;
    const result = await runVerifierAgent(limit);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/agents/verify:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 4. Tahap B1 & B2: Penulisan Hyper-Personalized & Pengiriman Sesuai Zona Waktu (04-outreach.ts - Orion)
app.post('/api/agents/outreach', async (req, res) => {
  try {
    const limit = Number(req.body?.limit) || 3;
    const strictTimezoneWindow = req.body?.strictTimezoneWindow === true;
    const result = await runOutreachAgent(limit, { strictTimezoneWindow });
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/agents/outreach:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 5. Tahap B3: Pemindaian Inbox Otomatis, Klasifikasi Status, Draf PDF, & Notif Telegram (05-inbox-watcher.ts - Echo)
app.post('/api/agents/sync-inbox', async (req, res) => {
  try {
    const result = await runSyncInboxAgent();
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/agents/sync-inbox:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 6. Tahap C1 & C2: Follow-Up Berjenjang (H+4, H+9) & Jalur Alternatif (H+14) (06-followup.ts - Nova)
app.post('/api/agents/followup', async (req, res) => {
  try {
    const result = await runFollowupAgent();
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/agents/followup:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 7. Run All 6-Stage Pipeline (Full Blueprint Orchestrator)
app.post('/api/agents/run-all', async (req, res) => {
  try {
    console.log('[Run All] Memulai orkestrasi 6 Tahap Blueprint (A1 -> C2)...');
    const syncRes = await runSyncInboxAgent();
    const fuRes = await runFollowupAgent();
    const discRes = await runDiscoverAgent(3);
    const enrichRes = await runEnrichAgent(3);
    const verifyRes = await runVerifierAgent(3);
    const outreachRes = await runOutreachAgent(2, { strictTimezoneWindow: false });

    res.json({
      success: true,
      message: 'Orkestrasi seluruh 6 Tahap AI (A1 s/d C2) berhasil dijalankan.',
      steps: {
        syncInbox: syncRes,
        followup: fuRes,
        discover: discRes,
        enrich: enrichRes,
        verify: verifyRes,
        outreach: outreachRes,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/agents/run-all:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 8. AI CRM Manager Chat Endpoint
app.get('/api/manager/history', (req, res) => {
  try {
    const history = getStoredChatHistory();
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal mengambil riwayat chat.' });
  }
});

app.post('/api/manager/clear', (req, res) => {
  try {
    const history = resetStoredChatHistory();
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal mereset riwayat chat.' });
  }
});

app.post('/api/manager/chat', async (req, res) => {
  try {
    const { messages, message } = req.body;
    const history = messages || [];
    const latestUserMessage = message || (history.length > 0 ? history[history.length - 1].content : '');

    if (!latestUserMessage) {
      return res.status(400).json({ success: false, message: 'Pesan user tidak boleh kosong.' });
    }

    const result = await runManagerChat(history, latestUserMessage);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error in /api/manager/chat:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
});

// 9. Vercel & Local Cron Job Endpoint (24/7 Cloud Background Engine)
app.all('/api/cron/pipeline', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized cron trigger' });
    }

    if (isServerSupabaseConfigured()) {
      const { data: settings } = await supabaseServer.from('settings').select('is_global_paused').eq('id', 1).single();
      if (settings?.is_global_paused) {
        return res.json({ success: true, message: 'Engine sedang dijeda secara global oleh Adrien. Cron dilewati.' });
      }
    }

    console.log(`[Cron Runner 24/7] Memulai eksekusi background pipeline: ${new Date().toISOString()}`);
    const syncInbox = await runSyncInboxAgent();
    const followup = await runFollowupAgent();
    const discovery = await runDiscoverAgent(3);
    const enrichment = await runEnrichAgent(3);
    const verifier = await runVerifierAgent(3);
    const outreach = await runOutreachAgent(2, { strictTimezoneWindow: true });

    res.json({
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
    console.error('Error in /api/cron/pipeline:', err);
    res.status(500).json({ success: false, message: err.message || 'Cron error' });
  }
});

// 10. Asset & Document Vault Endpoints
app.get('/api/vault/documents', (req, res) => {
  try {
    const docs = getVaultDocuments();
    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal memuat dokumen vault' });
  }
});

app.post('/api/vault/documents', (req, res) => {
  try {
    const { title, fileName, fileSize, category, triggerContext, contextRule } = req.body;
    if (!title || !fileName) {
      return res.status(400).json({ success: false, message: 'Nama dokumen dan nama file wajib diisi.' });
    }
    const newDoc = addVaultDocument({
      title,
      fileName,
      fileSize: fileSize || '1.5 MB',
      category: category || 'custom',
      triggerContext: triggerContext || 'custom',
      contextRule: contextRule || 'Hanya dikirim jika diminta oleh brand',
      isColdEmailAllowed: false, // ATURAN BAKU: 0 Lampiran di cold outreach
      url: `/uploads/documents/${fileName}`,
    });
    res.json({ success: true, document: newDoc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal menyimpan dokumen' });
  }
});

app.delete('/api/vault/documents/:id', (req, res) => {
  try {
    const success = removeVaultDocument(req.params.id);
    res.json({ success, message: success ? 'Dokumen dihapus dari Vault' : 'Dokumen tidak ditemukan' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 11. Excluded Brands (Blacklist) Endpoints
app.get('/api/excluded-brands', (req, res) => {
  try {
    const list = getExcludedBrands();
    res.json({ success: true, excludedBrands: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/excluded-brands', async (req, res) => {
  try {
    const { name, domain, reason } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama brand wajib diisi' });
    }
    const brand = await addExcludedBrand(name, domain, reason);
    res.json({ success: true, brand });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/excluded-brands/:id', (req, res) => {
  try {
    const success = removeExcludedBrand(req.params.id);
    res.json({ success, message: success ? 'Brand dihapus dari blacklist' : 'Brand tidak ditemukan' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// OAuth2 Callback route: Otomatis menukar code menjadi Refresh Token dan menyimpan ke .env
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('<h3>Error: Tidak ada parameter kode otorisasi dari Google.</h3>');
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).send('<h3>Error: GMAIL_CLIENT_ID atau GMAIL_CLIENT_SECRET belum diisi di .env</h3>');
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3001/oauth2callback'
    );

    const { tokens } = await oAuth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (refreshToken) {
      try {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/GMAIL_REFRESH_TOKEN=.*/, `GMAIL_REFRESH_TOKEN=${refreshToken}`);
        } else {
          envContent += `\nGMAIL_REFRESH_TOKEN=${refreshToken}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf-8');
        process.env.GMAIL_REFRESH_TOKEN = refreshToken;
        console.log(`[OAuth2] GMAIL_REFRESH_TOKEN berhasil disimpan ke .env: ${refreshToken.slice(0, 15)}...`);
      } catch (fileErr) {
        console.error('Gagal menulis refresh token ke .env:', fileErr);
      }

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Gmail Terhubung!</title>
            <meta charset="utf-8" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f17; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #111827; border: 1px solid #1f2937; padding: 40px; border-radius: 16px; text-align: center; max-width: 520px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
              .icon { font-size: 48px; margin-bottom: 16px; }
              h1 { font-size: 24px; color: #10b981; margin: 0 0 12px 0; }
              p { font-size: 14px; color: #9ca3af; line-height: 1.6; }
              .code-box { background: #1f2937; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; margin: 20px 0; color: #6ee7b7; border: 1px solid #374151; }
              .btn { display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">🎉</div>
              <h1>Gmail Berhasil Terhubung!</h1>
              <p>Refresh token Google OAuth2 Anda telah <b>berhasil didapatkan dan otomatis disimpan ke file .env</b>.</p>
              <div class="code-box">GMAIL_REFRESH_TOKEN=${refreshToken}</div>
              <p>Anda dapat menutup tab ini dan kembali ke Dashboard Outbound CRM.</p>
              <br />
              <a href="http://localhost:5173/" class="btn">Buka Dashboard CRM</a>
            </div>
          </body>
        </html>
      `);
    } else {
      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #f59e0b;">Perhatian: Google tidak mengembalikan refresh token baru</h2>
            <p>Ini biasanya terjadi jika akun sudah pernah diberi izin sebelumnya.</p>
            <p>Silakan coba kembali dan pastikan memilih akun yang sesuai atau hapus izin aplikasi di myaccount.google.com/permissions.</p>
          </body>
        </html>
      `);
    }
  } catch (err: any) {
    console.error('Error saat menukar token Google:', err.message);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gagal Menukar Token</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: sans-serif; background: #0b0f17; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #111827; border: 1px solid #dc2626; padding: 40px; border-radius: 16px; text-align: center; max-width: 500px; }
            h2 { color: #ef4444; }
            p { font-size: 14px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Gagal Menukar Token dengan Google</h2>
            <p><b>Penyebab:</b> ${err.message}</p>
            <p><i>Catatan: Pastikan GMAIL_CLIENT_SECRET di file .env Anda adalah Client Secret Google yang diawali dengan <code>GOCSPX-...</code>, bukan Client ID yang sama.</i></p>
          </div>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [Backend Server] Creator Outbound AI (6-Stage Blueprint) berjalan di http://localhost:${PORT}`);
  console.log(`📡 [Proxy Ready] Frontend Vite di port 5173 meneruskan /api ke port ${PORT}`);

  // Background non-stop runner (fondasi cloud/local: berjalan otomatis tiap 10 menit jika Engine Aktif)
  const CYCLE_INTERVAL_MS = 10 * 60 * 1000;
  setInterval(async () => {
    try {
      if (isServerSupabaseConfigured()) {
        const { data: settings } = await supabaseServer.from('settings').select('is_global_paused').eq('id', 1).single();
        if (settings?.is_global_paused) {
          return;
        }
      }
      console.log(`[Auto Background Runner 24/7] Menjalankan siklus berkala: ${new Date().toISOString()}`);
      await runSyncInboxAgent();
      await runFollowupAgent();
      await runDiscoverAgent(3);
      await runEnrichAgent(3);
      await runVerifierAgent(3);
      await runOutreachAgent(2, { strictTimezoneWindow: true });
    } catch (err: any) {
      console.warn('[Auto Background Runner] Siklus dijeda/dilewati:', err.message);
    }
  }, CYCLE_INTERVAL_MS);
});
