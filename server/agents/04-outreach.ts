import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { getGmailClient, isGmailConfigured, createRawEmail } from '../gmail-client.js';
import { isBrandExcluded } from '../excluded-brands.js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type TimezoneRegionSlot = 'ASIA_AUSTRALIA_PAGI_WIB' | 'EROPA_SORE_WIB' | 'AMERIKA_MALAM_WIB';

/**
 * PENGAMAN TEKNIS #2: Evaluasi Jam Kerja Ketat (Selasa - Kamis, 08:30 - 11:30 Pagi Waktu Lokal)
 */
export function evaluateStrictBusinessHours(
  timezoneStr: string
): { isBusinessHours: boolean; localDay: string; localTimeStr: string } {
  try {
    const tzMatch = (timezoneStr || '').match(/([A-Za-z_]+\/[A-Za-z_]+)/);
    const validTz = tzMatch ? tzMatch[1] : (timezoneStr && timezoneStr.includes('/') ? timezoneStr.trim() : 'UTC');

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTz,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const totalMinutes = hour * 60 + minute;

    // Hanya hari Selasa, Rabu, Kamis
    const isTueWedThu = ['Tue', 'Wed', 'Thu'].includes(weekday);
    // Jam 08:30 s/d 11:30 pagi (8*60+30 = 510 s/d 11*60+30 = 690 menit)
    const isInWindow = totalMinutes >= 510 && totalMinutes <= 690;

    return {
      isBusinessHours: isTueWedThu && isInWindow,
      localDay: weekday,
      localTimeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  } catch {
    return { isBusinessHours: true, localDay: 'Unknown', localTimeStr: 'N/A' };
  }
}

/**
 * PENGAMAN TEKNIS: Penyesuaian Zona Waktu (Timezone-Aware Sending Slot)
 * - Brand Amerika / Kanada -> dikirim Malam hari WIB (19:00 - 02:59 WIB = Pagi waktu Amerika)
 */
export function evaluateTimezoneSendingWindow(
  country: string,
  timezone: string
): {
  slot: TimezoneRegionSlot;
  slotLabel: string;
  currentHourWib: number;
  isOptimalWindowNow: boolean;
} {
  // Hitung jam saat ini dalam WIB (UTC+7)
  const now = new Date();
  const utcHour = now.getUTCHours();
  const currentHourWib = (utcHour + 7) % 24;

  const c = (country || '').toLowerCase();
  const tz = (timezone || '').toLowerCase();

  let slot: TimezoneRegionSlot = 'AMERIKA_MALAM_WIB';
  let slotLabel = 'Malam WIB (19:00–02:00 WIB / Pagi Waktu Amerika)';

  if (
    c.includes('singapore') ||
    c.includes('australia') ||
    c.includes('japan') ||
    c.includes('korea') ||
    c.includes('malaysia') ||
    c.includes('indonesia') ||
    c.includes('hong kong') ||
    c.includes('taiwan') ||
    c.includes('india') ||
    tz.includes('asia/') ||
    tz.includes('australia/') ||
    tz.includes('gmt+7') ||
    tz.includes('gmt+8') ||
    tz.includes('gmt+9') ||
    tz.includes('gmt+10')
  ) {
    slot = 'ASIA_AUSTRALIA_PAGI_WIB';
    slotLabel = 'Pagi WIB (06:00–12:59 WIB / Pagi Waktu Asia & Australia)';
  } else if (
    c.includes('germany') ||
    c.includes('united kingdom') ||
    c.includes('uk') ||
    c.includes('france') ||
    c.includes('netherlands') ||
    c.includes('switzerland') ||
    c.includes('sweden') ||
    c.includes('spain') ||
    c.includes('italy') ||
    c.includes('estonia') ||
    c.includes('ireland') ||
    tz.includes('europe/') ||
    tz.includes('gmt+0') ||
    tz.includes('gmt+1') ||
    tz.includes('gmt+2') ||
    tz.includes('gmt+3')
  ) {
    slot = 'EROPA_SORE_WIB';
    slotLabel = 'Sore WIB (13:00–18:59 WIB / Pagi Waktu Eropa)';
  }

  let isOptimalWindowNow = false;
  if (slot === 'ASIA_AUSTRALIA_PAGI_WIB') {
    isOptimalWindowNow = currentHourWib >= 6 && currentHourWib <= 12;
  } else if (slot === 'EROPA_SORE_WIB') {
    isOptimalWindowNow = currentHourWib >= 13 && currentHourWib <= 18;
  } else {
    // Amerika Malam WIB: 19:00 s/d 23:59 atau 00:00 s/d 02:59 WIB
    isOptimalWindowNow = currentHourWib >= 19 || currentHourWib <= 2;
  }

  return {
    slot,
    slotLabel,
    currentHourWib,
    isOptimalWindowNow,
  };
}

/**
 * TAHAP B1 & B2: Penulisan Hyper-Personalized & Pengiriman Sesuai Zona Waktu (04-outreach.ts)
 * - Maksimal 35-45 email per hari dengan jeda manusiawi.
 * - Mengambil brand yang emailnya sudah terverifikasi (email_verified = true).
 * - Gemini API menulis email 3 paragraf singkat TANPA lampiran PDF:
 *   * Paragraf 1: Detail spesifik produk mereka dari Tahap A2.
 *   * Paragraf 2: Menawarkan posisi kreator menjembatani edukasi produk ke pasar Indonesia + ide konten.
 *   * Paragraf 3: Ajakan diskusi ringan tanpa paksaan.
 * - Penyesuaian Jam Kerja Negara Tujuan (Timezone-Aware Sending).
 * - Pencatatan Akurat 100%: Transaksi atomik mengunci status menjadi 'cold_sent' (Sudah Dihubungi) + threadId + messageId + last_contacted_at.
 */
export async function runOutreachAgent(
  maxToSend = 3,
  options: {
    strictTimezoneWindow?: boolean;
    enforceBusinessHours?: boolean;
    fastJitter?: boolean;
  } = {}
): Promise<{
  success: boolean;
  sentCount: number;
  deferredTimezoneCount: number;
  message: string;
  sentBrands: any[];
}> {
  if (!isGmailConfigured()) {
    return {
      success: false,
      sentCount: 0,
      deferredTimezoneCount: 0,
      message: 'Gmail OAuth2 belum dikonfigurasi di file .env. Jalankan "npm run gmail:auth" untuk menghubungkan.',
      sentBrands: [],
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil pengaturan settings & cek batasan kuota harian (35-45 email/hari)
  let settings: any = {
    is_global_paused: false,
    daily_email_limit: 35,
    emails_sent_today: 0,
    followup_1_delay_days: 4,
    sender_name: 'Adrien Fandra',
    sender_email: process.env.GMAIL_USER_EMAIL || 'adrien@yourdomain.co',
    rope_system_prompt:
      'Write a concise cold email (under 100 words, 3 paragraphs, zero attachments) using the R.O.P.E. framework. Never open with "My name is". Paragraph 1: mention a specific observation about their product from research. Paragraph 2: position yourself as an Indonesian creator ready to educate and bridge their product to the Indonesian market with 1 concrete content concept. Paragraph 3: end with a low-friction question.',
  };

  if (isServerSupabaseConfigured()) {
    const { data: dbSettings } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
    if (dbSettings) settings = { ...settings, ...dbSettings };
  }

  // WAVE 1: RESET HARIAN (emails_sent_today & bounces_today) saat pergantian hari WIB
  const todayWibStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const lastUpdateWibStr = settings.updated_at
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(settings.updated_at))
    : '';

  if (todayWibStr !== lastUpdateWibStr && isServerSupabaseConfigured()) {
    console.log(`[Tahap B1-B2 - Daily Reset] Pergantian hari WIB (${lastUpdateWibStr} -> ${todayWibStr}). Mereset kuota & bounce.`);
    try {
      await supabaseServer
        .from('settings')
        .update({
          emails_sent_today: 0,
          bounces_today: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      settings.emails_sent_today = 0;
      settings.bounces_today = 0;
    } catch (e) {
      console.warn('Gagal reset harian di Supabase:', e);
    }
  }

  // WAVE 1: DELIVERABILITY GUARD - CIRCUIT BREAKER BOUNCE CHECK
  if ((settings.bounces_today || 0) > (settings.max_daily_bounces || 2)) {
    if (!settings.is_global_paused && isServerSupabaseConfigured()) {
      await supabaseServer.from('settings').update({ is_global_paused: true }).eq('id', 1);
    }
    return {
      success: false,
      sentCount: 0,
      deferredTimezoneCount: 0,
      message: `CIRCUIT BREAKER AKTIF! Jumlah bounce hari ini (${settings.bounces_today}) melebihi batas (${settings.max_daily_bounces || 2}). Engine dijeda otomatis demi melindungi reputasi email.`,
      sentBrands: [],
    };
  }

  if (settings.is_global_paused) {
    return {
      success: false,
      sentCount: 0,
      deferredTimezoneCount: 0,
      message: 'Engine sedang dijeda (is_global_paused = true). Pengiriman email ditangguhkan.',
      sentBrands: [],
    };
  }

  const remainingQuota = settings.daily_email_limit - settings.emails_sent_today;
  if (remainingQuota <= 0) {
    return {
      success: false,
      sentCount: 0,
      deferredTimezoneCount: 0,
      message: `Batas kuota harian aman (${settings.daily_email_limit} email/hari) telah tercapai hari ini.`,
      sentBrands: [],
    };
  }

  const limitForThisBatch = Math.min(maxToSend, remainingQuota);

  // 2. Ambil brand yang emailnya SUDAH TERVERIFIKASI
  let verifiedBrands: any[] = [];
  if (isServerSupabaseConfigured()) {
    const { data: brands, error } = await supabaseServer
      .from('brands')
      .select('*')
      .in('pipeline_status', ['enriched', 'verified'])
      .eq('outreach_channel', 'email_auto')
      .eq('email_verified', true)
      .not('primary_email', 'is', null)
      .limit(limitForThisBatch * 2);

    if (error) {
      throw new Error(`Gagal mengambil brand terverifikasi dari Supabase: ${error.message}`);
    }
    // Filter do_not_contact secara aman (bekerja baik ada kolomnya maupun tidak di Supabase)
    verifiedBrands = (brands || []).filter((b: any) => b.do_not_contact !== true);
  }

  if (verifiedBrands.length === 0) {
    return {
      success: true,
      sentCount: 0,
      deferredTimezoneCount: 0,
      message: 'Tidak ada brand berstatus Terverifikasi (verified / email_verified=true) yang siap dikirimi cold email.',
      sentBrands: [],
    };
  }

  const gmail = getGmailClient()!;
  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
  const isSafeTestMode = process.env.SAFE_TEST_MODE === 'true';
  const testRecipient = process.env.TEST_RECIPIENT_EMAIL || settings.sender_email;

  const sentList: any[] = [];
  let deferredTimezoneCount = 0;

  for (const brand of verifiedBrands) {
    if (brand.do_not_contact) {
      console.log(`[Tahap B1-B2 - Deliverability Guard] Brand ${brand.company_name} berstatus do_not_contact = true -> SKIP!`);
      continue;
    }

    if (isBrandExcluded(brand.domain) || isBrandExcluded(brand.company_name)) {
      console.log(`[Tahap B1-B2 - Orion] Melewati brand yang dikecualikan (Blacklist): ${brand.company_name} (${brand.domain})`);
      continue;
    }

    if (sentList.length >= limitForThisBatch) break;

    // 3. Cek Penyesuaian Jam Kerja Negara Tujuan (Timezone-Aware Sending & Strict Business Hours)
    const tzEval = evaluateTimezoneSendingWindow(brand.country, brand.timezone);
    if (options.strictTimezoneWindow && !tzEval.isOptimalWindowNow) {
      deferredTimezoneCount++;
      console.log(
        `[Tahap B1-B2 - Timezone Shield] Menunda pengiriman ke ${brand.company_name} (${brand.country}). Jadwal optimal: ${tzEval.slotLabel} (Saat ini: ${tzEval.currentHourWib}:00 WIB)`
      );
      continue;
    }

    // WAVE 1: Deliverability Guard (Selasa - Kamis, 08:30 - 11:30 Pagi Waktu Lokal)
    const shouldEnforceHours =
      options.enforceBusinessHours !== undefined
        ? options.enforceBusinessHours
        : settings.enforce_business_hours !== false && !isSafeTestMode;

    if (shouldEnforceHours) {
      const strictHours = evaluateStrictBusinessHours(brand.timezone);
      if (!strictHours.isBusinessHours) {
        deferredTimezoneCount++;
        console.log(
          `[Tahap B1-B2 - Deliverability Guard] Menunda ke ${brand.company_name} (${brand.timezone}). Waktu lokal: ${strictHours.localDay} ${strictHours.localTimeStr}. Hanya kirim Selasa-Kamis 08:30-11:30 waktu lokal.`
        );
        continue;
      }
    }

    // WAVE 1: Human Jitter (3 - 7 menit antar email di production mode, 3 detik di test / fast mode)
    if (sentList.length > 0) {
      const jitterMs =
        isSafeTestMode || options.fastJitter
          ? 3000
          : Math.floor(Math.random() * (420000 - 180000 + 1)) + 180000;
      console.log(`[Tahap B1-B2 - Human Jitter] Menunggu ${Math.round(jitterMs / 1000)} detik sebelum memproses email berikutnya...`);
      await sleep(jitterMs);
    }

    // WAVE 1: Penugasan Varian A/B/C Otomatis (Round-Robin / Lowest Count)
    const activeVariants: ('A' | 'B' | 'C')[] =
      Array.isArray(settings.active_email_variants) && settings.active_email_variants.length > 0
        ? settings.active_email_variants
        : ['A', 'B', 'C'];

    let chosenVariant: 'A' | 'B' | 'C' = activeVariants[0];
    if (isServerSupabaseConfigured() && activeVariants.length > 1) {
      try {
        const counts: Record<string, number> = {};
        for (const v of activeVariants) {
          const { count } = await supabaseServer
            .from('brands')
            .select('id', { count: 'exact', head: true })
            .eq('email_variant', v);
          counts[v] = count || 0;
        }
        activeVariants.sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
        chosenVariant = activeVariants[0];
      } catch (e) {
        console.warn('Gagal menghitung varian di Supabase, fallback ke varian pertama:', e);
      }
    }

    let selectedVariantPrompt = settings.variant_a_prompt || settings.rope_system_prompt;
    if (chosenVariant === 'B') {
      selectedVariantPrompt = settings.variant_b_prompt || settings.rope_system_prompt;
    } else if (chosenVariant === 'C') {
      selectedVariantPrompt = settings.variant_c_prompt || settings.rope_system_prompt;
    }

    console.log(
      `[Tahap B1-B2 - 04-outreach] Menyusun email Hyper-Personalized [Varian ${chosenVariant}] untuk: ${brand.company_name} <${brand.primary_email}> [${tzEval.slotLabel}]`
    );

    // WAVE 1: Creator Proof Bank Context Injection
    const proofBankContext = `
=== CREATOR PROOF BANK (OTORITAS & BUKTI NYATA ADRIEN FANDRA) ===
- Metrik Audiens: ${settings.creator_metrics || '185k+ followers across YouTube & LinkedIn. 72% Indonesia, 18-34 yo software engineers, tech freelancers, remote workers.'}
- Bukti Konversi & Portofolio: ${settings.creator_social_proof || 'Previous Collaborations: Notion, Wise, Raycast. 1,400+ signups generated. 4.8% CTR on partnership links.'}
- Gaya & Karakter Konten: ${settings.creator_content_style || 'Logic-first, analytical, deep architectural breakdown, zero fluff, transparent benchmarks.'}

ATURAN STRUKTURAL DARI ADRIEN:
- DILARANG KERAS menggunakan kalimat klise ("My name is...", "Hope this email finds you well", "I was impressed by...").
- Wajib menggunakan observasi unik produk mereka dan menyertakan data konkret atau bukti nyata dari Proof Bank di atas.
`;

    // 4. Generate Cold Email Tanpa Lampiran PDF sesuai Varian A/B/C
    const prompt = `
Sistem Prompt Instruksi Varian ${chosenVariant}:
${selectedVariantPrompt}

${proofBankContext}

Data Target Brand:
- Nama Perusahaan: ${brand.company_name}
- Domain: ${brand.domain}
- Negara & Zona Waktu: ${brand.country} (${brand.timezone})
- Nama PIC: ${brand.primary_pic_name || brand.founder_name || 'Partnership Team'}
- Rangkuman Produk (Hasil Riset Web): "${brand.product_summary || 'Productivity / Tech Tool'}"
- Sinyal Kemitraan: ${JSON.stringify(brand.buying_intent_signals || [])}
- Ide Konten Rekomendasi: "${(brand.suggested_content_ideas || [])[0] || 'Tutorial praktis integrasi workflow di Indonesia'}"

Aturan Format & Output:
- Wajib TEPAT 3 PARAGRAF (atau 3 kalimat jika Varian B), total di bawah 100 kata, ZERO attachments.
- Keluarkan format JSON dengan:
1. "subject": Subjek email tajam, personal, tidak bernada promosi/spam (maks 8 kata).
2. "body_text": Isi email dipisahkan dengan baris kosong (\\n\\n).
`;

    let responseText = '';
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
    ];

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT' as any,
              properties: {
                subject: { type: 'STRING' as any },
                body_text: { type: 'STRING' as any },
              },
              required: ['subject', 'body_text'],
            },
          },
        });
        responseText = response.text || '';
        if (responseText) break;
      } catch (err: any) {
        console.warn(`[Tahap B1-B2 - 04-outreach] Model ${model} gagal untuk ${brand.company_name}: ${err.message}. Mencoba model cadangan...`);
      }
    }

    try {
      if (!responseText) throw new Error('Seluruh model Gemini gagal menyusun email.');
      const emailDraft = JSON.parse(responseText || '{}');
      const realRecipient = brand.primary_email;
      const actualRecipient = isSafeTestMode ? testRecipient : realRecipient;
      const actualSubject = isSafeTestMode
        ? `[TEST OUTREACH - Target: ${brand.company_name} <${realRecipient}>] ${emailDraft.subject}`
        : emailDraft.subject;

      // 5. Kirim melalui Gmail API (0 Lampiran PDF di tahap cold outreach!)
      const raw = createRawEmail({
        to: actualRecipient,
        from: `${settings.sender_name} <${settings.sender_email}>`,
        subject: actualSubject,
        body: emailDraft.body_text,
      });

      const gmailRes = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
      });

      const sentAtIso = new Date().toISOString();
      const messageId = gmailRes.data.id || `msg_${Date.now()}`;
      const threadId = gmailRes.data.threadId || messageId;

      // Jadwalkan Follow-Up 1 (Hari ke-4)
      const followupDays = settings.followup_1_delay_days || 4;
      const nextFollowupDate = new Date();
      nextFollowupDate.setDate(nextFollowupDate.getDate() + followupDays);

      const emailHistoryItem = {
        id: messageId,
        direction: 'outbound' as const,
        subject: emailDraft.subject,
        snippet: emailDraft.body_text.slice(0, 140),
        sent_at: sentAtIso,
      };

      const existingHistory = Array.isArray(brand.email_history) ? brand.email_history : [];

      // 6. PENCATATAN AKURAT 100% (Penguncian Atomik di Supabase begitu 200 OK)
      if (isServerSupabaseConfigured()) {
        await supabaseServer
          .from('brands')
          .update({
            pipeline_status: 'cold_sent', // Sudah Dihubungi (Cold Sent)
            email_variant: chosenVariant,
            gmail_thread_id: threadId,
            gmail_message_id: messageId,
            last_contacted_at: sentAtIso,
            next_followup_at: nextFollowupDate.toISOString(),
            followup_count: 0,
            email_history: [...existingHistory, emailHistoryItem],
            notes: `[Tahap B2 - Terkirim 200 OK] Slot: ${tzEval.slotLabel} | Thread ID: ${threadId}`,
            updated_at: sentAtIso,
          })
          .eq('id', brand.id)
          .in('pipeline_status', ['enriched', 'verified']); // Atomic guard: mencegah pengiriman ganda
      }

      sentList.push({
        brand: brand.company_name,
        country: brand.country,
        timezoneSlot: tzEval.slotLabel,
        sentTo: actualRecipient,
        isTestMode: isSafeTestMode,
        threadId,
        messageId,
        sentAt: sentAtIso,
        subject: actualSubject,
      });

      // Jeda manusiawi (human-like jitter 1.5 - 3 detik antar email dalam batch)
      if (sentList.length < limitForThisBatch) {
        await sleep(1500 + Math.floor(Math.random() * 1500));
      }
    } catch (err: any) {
      console.error(`[Tahap B1-B2 - 04-outreach] Gagal mengirim email ke ${brand.company_name}:`, err.message);
    }
  }

  // Update counter emails_sent_today di settings & otomatis jeda global jika batas kuota tercapai
  if (isServerSupabaseConfigured() && sentList.length > 0) {
    const newTotalSent = (settings.emails_sent_today || 0) + sentList.length;
    const quotaReached = newTotalSent >= (settings.daily_email_limit || 5);

    await supabaseServer
      .from('settings')
      .update({
        emails_sent_today: newTotalSent,
        is_global_paused: quotaReached ? true : settings.is_global_paused,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (quotaReached) {
      console.log(
        `[Tahap B1-B2 - 04-outreach] 🎯 Target kuota uji coba (${settings.daily_email_limit} email) tercapai! Engine otomatis DIJEDA (is_global_paused = true) untuk keamanan reputasi domain.`
      );
    }
  }

  return {
    success: true,
    sentCount: sentList.length,
    deferredTimezoneCount,
    message: isSafeTestMode
      ? `[Tahap B1-B2 | SAFE_TEST_MODE] Berhasil mengirim ${sentList.length} email 3-paragraf ke ${testRecipient} (${deferredTimezoneCount} brand menunggu jadwal zona waktu).`
      : `[Tahap B1-B2 Selesai] Berhasil mengirim ${sentList.length} cold email sesuai zona waktu & dikunci atomik di Supabase.`,
    sentBrands: sentList,
  };
}
