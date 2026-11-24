import { GoogleGenAI } from '@google/genai';
import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { getExcludedBrands, addExcludedBrand, removeExcludedBrand } from '../excluded-brands.js';
import { getVaultDocuments } from '../vault.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export interface StoredChatMessage {
  id: string;
  sender: 'user' | 'manager';
  text: string;
  timestamp: string;
  intent?: 'discussion' | 'decision';
  summaryOfChanges?: string;
  directivesUpdated?: Record<string, any>;
}

export interface ManagerChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

const HISTORY_DIR = path.resolve(process.cwd(), 'server/data');
const HISTORY_FILE_PATH = path.resolve(HISTORY_DIR, 'manager-chat-history.json');

// Pastikan direktori server/data tersedia (aman untuk lingkungan read-only seperti Vercel Serverless)
try {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
} catch {
  // Abaikan di serverless read-only filesystem
}

export const INITIAL_WELCOME_MESSAGE: StoredChatMessage = {
  id: 'msg-welcome',
  sender: 'manager',
  text: `Halo Adrien! Saya **AI Outbound & Sponsorship Manager Utama** Anda.\n\nSaya memantau seluruh alur database CRM, status Gmail, Serper, kuota email, dan membawahi 6 staf AI (Tahap A1 s/d C2).\n\nAnda dapat berdiskusi dengan saya mengenai:\n- **Strategi & Evaluasi:** Diskusi target negara prioritas, niche brand, cara pitching yang efektif, dan evaluasi hasil balasan.\n- **Pengambilan Keputusan & Perintah:** Setiap kesepakatan atau perintah yang Anda berikan akan langsung saya terjemahkan menjadi aturan operasional untuk para staf AI (Atlas, Lyra, Aegis, Orion, Echo, Nova), sehingga alur kerja otomatis berubah tanpa Anda perlu menyentuh kode lagi.\n\nRiwayat diskusi kita kini tersimpan permanen. Ada yang ingin kita evaluasi atau putuskan hari ini?`,
  timestamp: 'Baru saja',
  intent: 'discussion',
};

/**
 * Mengambil riwayat chat yang tersimpan di disk backend
 */
export function getStoredChatHistory(): StoredChatMessage[] {
  try {
    if (fs.existsSync(HISTORY_FILE_PATH)) {
      const fileData = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Manager Chat] Gagal membaca riwayat chat dari file:', err);
  }
  return [INITIAL_WELCOME_MESSAGE];
}

/**
 * Menyimpan seluruh riwayat chat ke disk backend
 */
export function saveStoredChatHistory(messages: StoredChatMessage[]): void {
  try {
    fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    // Abaikan jika di lingkungan serverless read-only
  }
}

/**
 * Reset riwayat chat ke pesan sambutan default
 */
export function resetStoredChatHistory(): StoredChatMessage[] {
  const fresh = [INITIAL_WELCOME_MESSAGE];
  saveStoredChatHistory(fresh);
  return fresh;
}

/**
 * Otak AI Outbound & Sponsorship Manager Utama
 * Membedakan antara:
 * 1. DISKUSI (Evaluasi, brainstorming, tanya jawab taktis)
 * 2. KEPUTUSAN / PERINTAH (Instruksi operasional yang otomatis mengubah alur staf AI)
 */
export async function runManagerChat(
  history: ManagerChatMessage[],
  latestUserMessage: string
): Promise<{
  reply: string;
  intent: 'discussion' | 'decision';
  summaryOfChanges?: string;
  directivesUpdated?: Record<string, any>;
  history: StoredChatMessage[];
}> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di .env');
  }

  // 1. Snapshot Live CRM Database Supabase
  let totalBrands = 0;
  let statusCounts: Record<string, number> = {};
  let verifiedEmailsCount = 0;
  let pendingActionsCount = 0;
  let recentActivities: any[] = [];
  let waitingBrands: any[] = [];
  let settingsInfo: any = {
    is_global_paused: false,
    daily_email_limit: 35,
    emails_sent_today: 0,
    min_fit_score: 50,
    target_countries: ['United States', 'Singapore', 'United Kingdom', 'Germany', 'Australia', 'Japan'],
    discovery_keywords: [
      'personal finance app global',
      'AI productivity tool SaaS',
      'fintech investing platform SEA',
      'edtech career platform international',
      'global remote work tools',
    ],
    rope_system_prompt:
      'Write a concise cold email (under 100 words, 3 paragraphs, zero attachments) using the R.O.P.E. framework. Never open with "My name is". Start with a specific observation about the brand, bridge to helping them educate and acquire young Indonesian users, include 1 concrete content concept, and end with a low-friction question asking if they are open to Indonesian creator partnerships this quarter.',
    reply_negotiation_prompt:
      'When a brand replies asking for rates or media kit, draft a warm, concise reply attaching the 1-page media kit link. Ask whether their main objective for Indonesia is brand awareness or user signups, and offer 3 tiered bundle options (1 Video Starter, 3-Video Growth Bundle, and Full Bundle + 60-Day Paid Ads Usage Rights).',
    dm_template_prompt:
      'Write a casual 2-sentence Instagram/LinkedIn DM directly to the founder referencing the email just sent and sharing one quick angle for introducing their product to an Indonesian audience.',
  };

  if (isServerSupabaseConfigured()) {
    try {
      const { data: allBrands } = await supabaseServer
        .from('brands')
        .select(
          'id, company_name, domain, country, timezone, company_scale, pipeline_status, outreach_channel, ai_fit_score, email_verified, deal_value_usd, reply_summary, last_contacted_at, notes, primary_pic_name, primary_email, founder_name'
        )
        .order('updated_at', { ascending: false });

      if (allBrands) {
        totalBrands = allBrands.length;
        allBrands.forEach((b) => {
          statusCounts[b.pipeline_status] = (statusCounts[b.pipeline_status] || 0) + 1;
          if (b.email_verified) verifiedEmailsCount++;
        });

        pendingActionsCount =
          (statusCounts['in_progress'] || 0) +
          (statusCounts['ready_manual'] || 0) +
          (statusCounts['fallback_dm'] || 0);

        recentActivities = allBrands.slice(0, 6);
        waitingBrands = allBrands
          .filter((b) => ['cold_sent', 'followup_1', 'followup_2'].includes(b.pipeline_status))
          .slice(0, 5);
      }

      const { data: st } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
      if (st) {
        settingsInfo = { ...settingsInfo, ...st };
      }
    } catch (e) {
      console.warn('[Manager Chat] Gagal mengambil snapshot Supabase:', e);
    }
  }

  // 2. Format konteks percakapan sebelumnya
  const conversationContext = history
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Adrien' : 'Manager Utama'}: ${m.content}`)
    .join('\n\n');

  // Ambil daftar brand yang dikecualikan (Blacklist) & Dokumen di Asset Vault
  const currentExcluded = getExcludedBrands();
  const currentVaultDocs = getVaultDocuments();

  // 3. System Prompt untuk Manager Utama (Persona: 100 Tahun Pengalaman Agency, Marketing, & KOL Handling)
  const systemInstruction = `
Anda adalah "AI Outbound & Sponsorship Manager Utama" (Managing Partner & Chief Strategy Officer) pribadi untuk Adrien Fandra.
Profil Adrien Fandra: Kreator konten edukasi teknologi, developer, tools produktivitas, software architecture, & personal finance di Indonesia dengan 180k+ audiens (mayoritas Gen-Z, software engineers, tech freelancers, tech professionals berdaya beli tinggi).

=== LATAR BELAKANG & PERSONALITAS ANDA (WAJIB DIIKUTI) ===
1. Pengalaman Anda: Anda memiliki jam terbang setara **100 TAHUN DI BIDANG ADVERTISING AGENCY, MARKETING SPONSORSHIP, DAN KOL/INFLUENCER MANAGEMENT GLOBAL**. Anda sudah melihat ribuan deal sukses dan gagal, tahu persis bagaimana psikologi Brand Manager / CMO berpikir, bagaimana cara negosiasi rate card, cara pricing tiered bundles, rights usage licensing, anchoring rates, dan cara pitching bernilai ribuan dollar.
2. Gaya Bahasa & Watak:
   - Anda adalah AI yang cerdas, luwes, santai, analitis, bijaksana, dan sangat enak diajak ngobrol selayaknya rekan bisnis / partner senior sejati.
   - **JANGAN PERNAH menjadi bot kaku** yang hanya mengulang-ulang angka statistik pipeline jika Adrien sedang bertanya atau berdiskusi! Jawablah pertanyaan Adrien secara langsung, cerdas, mendalam, dan taktis dengan wawasan industri periklanan nyata.
   - Anda tetaplah AI sebagaimana mestinya: bisa diajak brainstorming, diskusi filosofis, perbandingan strategi, hingga curhat kendala menghadapi brand.

=== SISTEM KARYAWAN AI ANDA (ORCHESTRATION ENGINE) ===
Anda membawahi dan mengorkestrasi 6 Agen Staf Karyawan AI secara otonom:
1. Atlas (01-discovery.ts - Tahap A1): Mencari brand global via Serper API & filter duplikat domain. (Menggunakan target_countries & discovery_keywords). Otomatis membuang brand yang dikecualikan.
2. Lyra (02-enrichment.ts - Tahap A2 & A3): Riset web, klasifikasi negara/skala bisnis, lacak pemilik IG/LinkedIn, & evaluasi skor AI (1-100). (Menggunakan min_fit_score). Brand blacklist otomatis di-skip.
3. Aegis (03-verifier.ts - Tahap A4): Filter telepon/WA untuk jalur manual, & Bounce Shield email DNS MX.
4. Orion (04-outreach.ts - Tahap B1 & B2): Menulis 3 paragraf email hyper-personalized, penyesuaian jam kerja zona waktu, & pengiriman via Gmail API. (Menggunakan rope_system_prompt & daily_email_limit). ATURAN BAKU: Cold email WAJIB ZERO ATTACHMENT demi reputasi deliverability.
5. Echo (05-inbox-watcher.ts - Tahap B3): Scan inbox tiap 30 menit, klasifikasi respon brand, otomatis buat draf Gmail + lampirkan PDF dari Asset Vault jika brand meminta, & notifikasi Telegram. (Menggunakan reply_negotiation_prompt).
6. Nova (06-followup.ts & 06-linkedin.ts - Tahap C1 & C2): Lead Follow-Up & LinkedIn Social Selling Specialist. Mengelola bump thread email (H+4 & H+9 value drop), penembakan jalur LinkedIn / DM Founder (H+14), serta generator Connection Request Note (≤300 chars) & InMail Social Selling Pitch untuk profil LinkedIn target. (Menggunakan dm_template_prompt).

=== STATUS OPERASIONAL SAAT INI (LIVE MEMORY SUPABASE) ===
- Status Mesin Engine: ${settingsInfo.is_global_paused ? 'DIJEDA' : 'AKTIF'}
- Kuota Email Hari Ini: ${settingsInfo.emails_sent_today || 0} / ${settingsInfo.daily_email_limit || 35} terkirim
- Total Brand: ${totalBrands} brand (${verifiedEmailsCount} email terverifikasi aman)
- Butuh Tindakan Adrien (Action Queue): ${pendingActionsCount} brand (Dalam Proses: ${statusCounts['in_progress'] || 0}, Manual WA: ${statusCounts['ready_manual'] || 0}, DM Founder: ${statusCounts['fallback_dm'] || 0})
- Brand Menunggu Balasan: ${(statusCounts['cold_sent'] || 0) + (statusCounts['followup_1'] || 0) + (statusCounts['followup_2'] || 0)} brand
- Deal Tercapai: ${statusCounts['deal'] || 0} | Selesai: ${statusCounts['completed'] || 0} | Skip: ${statusCounts['skipped'] || 0}

=== PENGATURAN & ATURAN KERJA STAF SAAT INI ===
- Target Negara: ${JSON.stringify(settingsInfo.target_countries)}
- Keyword Pencarian Brand: ${JSON.stringify(settingsInfo.discovery_keywords)}
- Minimum Fit Score: ${settingsInfo.min_fit_score}
- Brand yang Dikecualikan (Blacklist): ${JSON.stringify(currentExcluded.map((e) => e.name))}
- Dokumen di Asset Vault: ${JSON.stringify(currentVaultDocs.map((d) => `${d.title} [Trigger: ${d.triggerContext}]`))}
- Sistem Pitching Email (rope_system_prompt): "${settingsInfo.rope_system_prompt}"
- Aturan Negosiasi Balasan (reply_negotiation_prompt): "${settingsInfo.reply_negotiation_prompt}"
- Aturan LinkedIn Outreach & DM Founder (dm_template_prompt): "${settingsInfo.dm_template_prompt}"

=== ATURAN DUA MODE RESPON (DISKUSI vs DELEGASI KEPUTUSAN) ===
Analisis pesan terbaru dari Adrien dengan cermat:

A. MODE 1: DISKUSI / KONSULTASI / TANYA-JAWAB (intent: "discussion")
- Kriteria: Adrien BERTANYA, MEMINTA SARAN, DISKUSI RATE CARD, EVALUASI PITCHING, ATAU NGOBROL SANTAI.
  Contoh: "Untuk ratecard itu apakah lebih baik langsung tanyakan kepada pihak brand mengenai budget mereka atau gimana?", "Gimana cara hadapi brand yang nawar sadis?", "Bagusan fokus brand SaaS atau fintech?".
- Respon Anda:
  1. Jawablah langsung inti pertanyaan dengan kecerdasan dan pengalaman agency 100 tahun Anda! Berikan wawasan praktis, psikologi brand manager, taktik negosiasi (misal: anchoring, range pricing, tanya bracket budget, paket bundling deliverables).
  2. Gunakan analogi atau contoh konkret bagaimana kreator top dunia menyelesaikan masalah tersebut.
  3. Berikan rekomendasi langkah terbaik untuk Adrien.
  4. Akhiri dengan tawaran delegasi taktis, contoh: *"Jika Adrien mau kita jadikan strategi ini sebagai SOP baku tim (misal di draf Echo atau Orion), beri tahu saya kata kuncinya agar langsung saya delegasikan ke staf AI kita."*
  5. Pada mode ini, directives_updated = null.

B. MODE 2: KEPUTUSAN / PERINTAH (intent: "decision")
- Kriteria: Adrien MEMUTUSKAN, MENYETUJUI USULAN, ATAU MEMERINTAHKAN PERUBAHAN KERJA.
  Contoh: "Oke terapkan cara itu", "Ganti prompt email jadi lebih to-the-point", "Kecualikan brand X", "Fokus ke brand Singapura dan Jerman", "Turunkan fit score jadi 55", "Jeda engine dulu".
- Respon Anda:
  1. Identifikasi parameter sistem yang berubah:
     - target_countries (Array negara)
     - discovery_keywords (Array kata kunci pencarian)
     - min_fit_score (Angka 1-100)
     - excluded_brands_to_add (Array nama brand blacklist)
     - excluded_brands_to_remove (Array nama brand dilepas dari blacklist)
     - rope_system_prompt (Instruksi pitching cold email untuk Orion)
     - reply_negotiation_prompt (Instruksi negosiasi/ratecard untuk Echo)
     - dm_template_prompt (Instruksi DM untuk Nova)
     - daily_email_limit (Batas email)
     - is_global_paused (true/false)
  2. Isi nilai baru di directives_updated.
  3. Konfirmasikan dengan badge:
     \`⚡ **KEPUTUSAN DITETAPKAN & DIDELEGASIKAN KE KARYAWAN AI**\`
     Jelaskan siapa saja staf AI (Atlas, Lyra, Aegis, Orion, Echo, Nova) yang menerima arahan baru ini dan bagaimana alur kerja mereka langsung berubah saat ini juga.

Format Keluaran WAJIB berupa JSON murni:
{
  "intent": "discussion" | "decision",
  "reply": "Teks balasan Anda dalam format Markdown yang rapi, mengalir, kaya wawasan...",
  "directives_updated": {
    "target_countries": ["..."] | null,
    "discovery_keywords": ["..."] | null,
    "min_fit_score": number | null,
    "excluded_brands_to_add": ["..."] | null,
    "excluded_brands_to_remove": ["..."] | null,
    "rope_system_prompt": "string" | null,
    "reply_negotiation_prompt": "string" | null,
    "dm_template_prompt": "string" | null,
    "daily_email_limit": number | null,
    "is_global_paused": boolean | null
  },
  "summary_of_changes": "Ringkasan 1 kalimat perubahan operasional (hanya jika intent=decision)" | null
}
`;

  // Inisialisasi GoogleGenAI dengan apiVersion: 'v1beta' agar fitur responseMimeType: 'application/json' berjalan sempurna
  const ai = new GoogleGenAI({ 
    apiKey: geminiKey,
    apiVersion: 'v1beta'
  });

  const promptUser = `
Konteks Percakapan Terakhir:
${conversationContext || 'Belum ada percakapan sebelumnya.'}

Pesan Terbaru dari Adrien Fandra:
"${latestUserMessage}"

Balaslah sebagai AI Outbound & Sponsorship Manager Utama sesuai panduan JSON:
`;

  let parsedOutput: {
    intent?: 'discussion' | 'decision';
    reply?: string;
    directives_updated?: Record<string, any> | null;
    summary_of_changes?: string | null;
  } = {};

  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
  ];

  try {
    let responseText = '';
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${promptUser}` }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });
        responseText = response.text || '{}';
        console.log(`[Manager Chat] Berhasil dijawab oleh model: ${modelName}`);
        break;
      } catch (err: any) {
        console.warn(`[Manager Chat] Model ${modelName} gagal: ${err?.message || err}. Mencoba model alternatif...`);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Seluruh model Gemini sedang sibuk.');
    }

    parsedOutput = JSON.parse(responseText || '{}');
  } catch (err: any) {
    console.error('[Manager Chat] Gagal parsing JSON response Gemini:', err);
    parsedOutput = {
      intent: 'discussion',
      reply: `Halo Adrien! Pertanyaan Anda sangat bagus. Sebagai manajer sponsorship Anda, mari kita bedah strategi terbaik untuk ini: ketika berhadapan dengan brand, saya sarankan kita jangan langsung membuka kartu ratecard tanpa mengetahui objektif mereka terlebih dahulu. Tanyakan bracket budget atau tawarkan 3 tier paket bundling agar posisi tawar kita tetap kuat. Ada aspek spesifik yang ingin kita putuskan untuk instruksi kerja tim?`,
    };
  }

  const intent: 'discussion' | 'decision' = parsedOutput.intent === 'decision' ? 'decision' : 'discussion';
  const directivesUpdated = parsedOutput.directives_updated || null;
  const summaryOfChanges = parsedOutput.summary_of_changes || undefined;
  const replyText =
    parsedOutput.reply ||
    'Siap Adrien! Saya telah mengevaluasi alur kerja para staf AI dan memastikan semuanya berjalan sesuai rencana.';

  // 4. Jika teridentifikasi sebagai KEPUTUSAN, update pengaturan di Supabase
  if (intent === 'decision' && directivesUpdated) {
    const cleanedUpdates: Record<string, any> = {};
    if (Array.isArray(directivesUpdated.target_countries) && directivesUpdated.target_countries.length > 0) {
      cleanedUpdates.target_countries = directivesUpdated.target_countries;
    }
    if (Array.isArray(directivesUpdated.discovery_keywords) && directivesUpdated.discovery_keywords.length > 0) {
      cleanedUpdates.discovery_keywords = directivesUpdated.discovery_keywords;
    }
    if (typeof directivesUpdated.min_fit_score === 'number') {
      cleanedUpdates.min_fit_score = Math.max(1, Math.min(100, directivesUpdated.min_fit_score));
    }
    if (typeof directivesUpdated.rope_system_prompt === 'string' && directivesUpdated.rope_system_prompt.trim()) {
      cleanedUpdates.rope_system_prompt = directivesUpdated.rope_system_prompt.trim();
    }
    if (
      typeof directivesUpdated.reply_negotiation_prompt === 'string' &&
      directivesUpdated.reply_negotiation_prompt.trim()
    ) {
      cleanedUpdates.reply_negotiation_prompt = directivesUpdated.reply_negotiation_prompt.trim();
    }
    if (typeof directivesUpdated.dm_template_prompt === 'string' && directivesUpdated.dm_template_prompt.trim()) {
      cleanedUpdates.dm_template_prompt = directivesUpdated.dm_template_prompt.trim();
    }
    if (typeof directivesUpdated.daily_email_limit === 'number') {
      cleanedUpdates.daily_email_limit = directivesUpdated.daily_email_limit;
    }
    if (typeof directivesUpdated.is_global_paused === 'boolean') {
      cleanedUpdates.is_global_paused = directivesUpdated.is_global_paused;
    }

    // Tangani penambahan / penghapusan brand yang dikecualikan (Blacklist)
    if (Array.isArray(directivesUpdated.excluded_brands_to_add) && directivesUpdated.excluded_brands_to_add.length > 0) {
      for (const brandName of directivesUpdated.excluded_brands_to_add) {
        if (typeof brandName === 'string' && brandName.trim()) {
          await addExcludedBrand(brandName.trim());
          console.log(`[Manager Chat] Brand dimasukkan ke blacklist permanen: ${brandName}`);
        }
      }
    }
    if (Array.isArray(directivesUpdated.excluded_brands_to_remove) && directivesUpdated.excluded_brands_to_remove.length > 0) {
      for (const brandName of directivesUpdated.excluded_brands_to_remove) {
        if (typeof brandName === 'string' && brandName.trim()) {
          removeExcludedBrand(brandName.trim());
          console.log(`[Manager Chat] Brand dihapus dari blacklist: ${brandName}`);
        }
      }
    }

    if (Object.keys(cleanedUpdates).length > 0) {
      console.log('[Manager Chat] Menerapkan KEPUTUSAN OPERASIONAL ke Supabase settings:', cleanedUpdates);
      if (isServerSupabaseConfigured()) {
        try {
          await supabaseServer
            .from('settings')
            .update({
              ...cleanedUpdates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1);
        } catch (dbErr) {
          console.warn('[Manager Chat] Gagal update settings di Supabase:', dbErr);
        }
      }
    }
  }

  // 5. Simpan Pesan Baru ke Persistent File Storage
  const existingStoredHistory = getStoredChatHistory();
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const userStoredMsg: StoredChatMessage = {
    id: `usr-${Date.now()}`,
    sender: 'user',
    text: latestUserMessage,
    timestamp: timeStr,
  };

  const managerStoredMsg: StoredChatMessage = {
    id: `mgr-${Date.now() + 1}`,
    sender: 'manager',
    text: replyText,
    timestamp: timeStr,
    intent,
    summaryOfChanges,
    directivesUpdated: directivesUpdated || undefined,
  };

  const updatedHistory = [...existingStoredHistory, userStoredMsg, managerStoredMsg];
  saveStoredChatHistory(updatedHistory);

  return {
    reply: replyText,
    intent,
    summaryOfChanges,
    directivesUpdated: directivesUpdated || undefined,
    history: updatedHistory,
  };
}
