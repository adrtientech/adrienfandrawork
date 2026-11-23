import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import {
  getGmailClient,
  isGmailConfigured,
  createRawEmail,
  getOrGenerateMediaKitPdfBase64,
} from '../gmail-client.js';
import { findDocumentForContext } from '../vault.js';
import { addExcludedBrand } from '../excluded-brands.js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PENGAMAN TEKNIS #4: Notifikasi Telegram / WhatsApp Alert untuk Keputusan Akhir
 */
export async function sendTelegramAlert(text: string, fallbackChatId?: string | null): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || fallbackChatId;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('[Tahap B3 - Telegram Alert] Gagal mengirim pesan notifikasi:', e);
    return false;
  }
}

/**
 * TAHAP B3: Pemindaian Inbox Otomatis, Klasifikasi Status 4 Kategori, Draf + PDF Media Kit, & Notifikasi Telegram (05-inbox-watcher.ts)
 * - Setiap 30 menit memeriksa kotak masuk melalui Gmail API dengan mencocokkan threadId yang tersimpan di Supabase.
 * - Stop Follow-Up Otomatis: Langsung mematikan jadwal follow-up (next_followup_at = null).
 * - Klasifikasi AI ke 4 kategori status:
 *     1. 'in_progress' (Dalam Proses: Brand tertarik, minta Media Kit / Rate Card, atau mengajak meeting)
 *     2. 'cancelled'   (Batal: Brand menolak atau belum ada budget ekspansi saat ini)
 *     3. 'deal'        (Deal: Kesepakatan tercapai)
 *     4. 'completed'   (Selesai: Kampanye telah tuntas)
 * - Penyusunan Draf + Lampiran PDF Media Kit: Otomatis membuat Gmail Draft berisi kalimat balasan sopan + lampiran file PDF Media Kit.
 * - Notifikasi Langsung ke HP via Bot Telegram:
 *   "🔥 Ada balasan positif dari [Nama Brand - Negara]! Ringkasan: ... Draf balasan + PDF sudah disiapkan di Gmail Anda, silakan cek dan klik Send."
 */
export async function runSyncInboxAgent(): Promise<{
  success: boolean;
  newRepliesCount: number;
  message: string;
  replies: any[];
}> {
  if (!isGmailConfigured()) {
    return {
      success: false,
      newRepliesCount: 0,
      message: 'Gmail OAuth2 belum dikonfigurasi di .env. Menggunakan mode simulasi / status hening.',
      replies: [],
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil settings dari Supabase
  let settings: any = {
    sender_name: 'Adrien Fandra',
    sender_email: process.env.GMAIL_USER_EMAIL || 'adrien@yourdomain.co',
    reply_negotiation_prompt:
      'When a brand replies asking for rates or media kit, draft a warm, concise reply attaching the 1-page media kit PDF. Ask whether their main objective for Indonesia is brand awareness or user signups, and offer 3 tiered bundle options (1 Video Starter, 3-Video Growth Bundle, and Full Bundle + 60-Day Paid Ads Usage Rights).',
    media_kit_pdf_url: 'https://creatoroutbound.co/media-kit-adrien-2026.pdf',
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || null,
  };

  if (isServerSupabaseConfigured()) {
    const { data: dbSettings } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
    if (dbSettings) settings = { ...settings, ...dbSettings };
  }

  // 2. Ambil brand aktif yang memiliki gmail_thread_id
  let activeBrands: any[] = [];
  if (isServerSupabaseConfigured()) {
    const { data: brands, error } = await supabaseServer
      .from('brands')
      .select('*')
      .not('gmail_thread_id', 'is', null)
      .in('pipeline_status', ['cold_sent', 'followup_1', 'followup_2', 'in_progress', 'deal']);

    if (error) {
      throw new Error(`Gagal mengambil brand dari Supabase: ${error.message}`);
    }
    activeBrands = brands || [];
  }

  if (activeBrands.length === 0) {
    return {
      success: true,
      newRepliesCount: 0,
      message: 'Tidak ada thread email aktif yang sedang menunggu pemindaian inbox Tahap B3.',
      replies: [],
    };
  }

  const gmail = getGmailClient()!;
  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
  const detectedReplies: any[] = [];

  // Siapkan lampiran PDF Media Kit untuk Gmail Draft
  const mediaKitAttachment = getOrGenerateMediaKitPdfBase64(
    settings.sender_name,
    settings.media_kit_pdf_url || 'https://creatoroutbound.co/media-kit-adrien-2026.pdf'
  );

  for (const brand of activeBrands) {
    try {
      const threadRes = await gmail.users.threads.get({
        userId: 'me',
        id: brand.gmail_thread_id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'Message-ID'],
      });

      const messages = threadRes.data.messages || [];
      if (messages.length <= 1) {
        continue;
      }

      const lastMessage = messages[messages.length - 1];
      const headers = lastMessage.payload?.headers || [];
      const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
      const messageIdHeader = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value || undefined;

      // Jika pengirim pesan terakhir adalah akun kita sendiri, lewati
      if (
        fromHeader.toLowerCase().includes(settings.sender_email.toLowerCase()) ||
        (process.env.GMAIL_USER_EMAIL &&
          fromHeader.toLowerCase().includes(process.env.GMAIL_USER_EMAIL.toLowerCase()))
      ) {
        continue;
      }

      // Cek apakah balasan masuk ini sudah pernah dicatat di email_history
      const existingHistory = Array.isArray(brand.email_history) ? brand.email_history : [];
      const isAlreadyRecorded = existingHistory.some((eh: any) => eh.id === lastMessage.id);
      if (isAlreadyRecorded) {
        continue;
      }

      const snippet = lastMessage.snippet || 'Balasan pesan baru dari brand.';
      console.log(`[Tahap B3 - 05-inbox-watcher] Pesan masuk terdeteksi dari ${brand.company_name}: "${snippet}"`);

      // =========================================================================
      // WAVE 1: DETEKTOR BOUNCE OTOMATIS & AUTO-PAUSE CIRCUIT BREAKER
      // =========================================================================
      const isBounce =
        fromHeader.toLowerCase().includes('mailer-daemon') ||
        fromHeader.toLowerCase().includes('postmaster') ||
        (lastMessage.snippet && /(delivery status notification|address not found|undeliverable|could not be delivered|mailbox unavailable|550 |554 )/i.test(lastMessage.snippet));

      if (isBounce) {
        console.warn(`[Tahap B3 - Deliverability Guard] BOUNCE TERDETEKSI untuk ${brand.company_name} <${brand.primary_email}>!`);
        
        const bounceHistoryItem = {
          id: lastMessage.id || `bounce_${Date.now()}`,
          direction: 'inbound' as const,
          subject: 'Delivery Status Notification (Failure)',
          snippet: `[BOUNCE GAGAL KIRIM] ${snippet}`,
          sent_at: new Date().toISOString(),
        };

        // Jika ada alternate_email, alihkan ke alternate dan kembalikan ke enriched
        let fallbackStatus: string = 'cancelled';
        let newPrimaryEmail = brand.primary_email;
        let newAlternateEmail = brand.alternate_email;

        if (brand.alternate_email) {
          newPrimaryEmail = brand.alternate_email;
          newAlternateEmail = null;
          fallbackStatus = 'enriched';
          console.log(`[Tahap B3 - Bounce Handler] Dialihkan ke alternate_email: ${newPrimaryEmail}`);
        } else if (brand.founder_instagram_url || brand.founder_linkedin_url) {
          fallbackStatus = 'fallback_dm';
          console.log(`[Tahap B3 - Bounce Handler] Tidak ada alternate email. Dialihkan ke jalur DM Founder.`);
        }

        // Naikkan hitungan bounces_today di settings
        const currentBounces = (settings.bounces_today || 0) + 1;
        settings.bounces_today = currentBounces;

        if (isServerSupabaseConfigured()) {
          await supabaseServer
            .from('brands')
            .update({
              email_verified: false,
              primary_email: newPrimaryEmail,
              alternate_email: newAlternateEmail,
              pipeline_status: fallbackStatus,
              email_history: [...existingHistory, bounceHistoryItem],
              notes: `[Bounce Shield] Email gagal terkirim (Bounce). Dialihkan ke status: ${fallbackStatus}.`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', brand.id);

          await supabaseServer
            .from('settings')
            .update({
              bounces_today: currentBounces,
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1);

          // CIRCUIT BREAKER TRIGGER: Jika melebihi max_daily_bounces
          const maxBounces = settings.max_daily_bounces || 2;
          if (currentBounces > maxBounces) {
            console.error(`🚨 [CIRCUIT BREAKER TRIGGERED] Bounces hari ini (${currentBounces}) > max (${maxBounces})! Menghentikan pengiriman global.`);
            await supabaseServer.from('settings').update({ is_global_paused: true }).eq('id', 1);
            settings.is_global_paused = true;

            await sendTelegramAlert(
              `🚨 <b>CIRCUIT BREAKER AKTIF! SISTEM DIJEDA OTOMATIS</b>\n\n` +
              `Jumlah bounce hari ini mencapai <b>${currentBounces} email</b> (Batas aman: ${maxBounces})!\n\n` +
              `Pengiriman cold email seketika <b>DIJEDA TOTAL</b> untuk melindungi domain dan akun Gmail Anda dari risiko reputasi buruk Google.\n` +
              `Silakan periksa daftar email yang mental di dashboard.`,
              settings.telegram_chat_id
            );
          }
        }

        detectedReplies.push({
          brand: brand.company_name,
          country: brand.country,
          status: fallbackStatus,
          summary: 'Email mental / bounce gagal kirim.',
          draftCreatedWithPdf: false,
          pdfFilename: null,
          telegramNotified: currentBounces > (settings.max_daily_bounces || 2),
        });
        continue;
      }

      // =========================================================================
      // 3. KLASIFIKASI AI KE 4 KATEGORI STATUS & PENYUSUNAN DRAF NEGOSIASI
      // =========================================================================
      const proofBankContext = `
=== CREATOR PROOF BANK (OTORITAS & BUKTI NYATA ADRIEN FANDRA) ===
- Metrik Audiens: ${settings.creator_metrics || '185k+ followers across YouTube & LinkedIn. 72% Indonesia, 18-34 yo software engineers, tech freelancers, remote workers.'}
- Bukti Konversi & Portofolio: ${settings.creator_social_proof || 'Collaborations: Notion, Wise, Raycast. 1,400+ signups generated. 4.8% CTR.'}
- Gaya & Karakter Konten: ${settings.creator_content_style || 'Logic-first, analytical, deep architectural breakdown, zero fluff.'}
`;

      const prompt = `
Sistem Prompt Negosiasi (Tahap B3 Blueprint):
${settings.reply_negotiation_prompt}

${proofBankContext}

Kreator: ${settings.sender_name} (Media Kit PDF: ${settings.media_kit_pdf_url || 'https://creatoroutbound.co/media-kit-adrien-2026.pdf'})
Brand: ${brand.company_name} (${brand.country})
PIC: ${brand.primary_pic_name || 'Partnership Team'}

Teks Balasan Masuk Dari Brand:
"${snippet}"

Instruksi Klasifikasi Wajib:
1. Pilih TEPAT SATU status (classified_status):
   - "in_progress" = Dalam Proses (Brand tertarik, meminta Media Kit / Rate Card, bertanya demografi audiens, atau mengajak meeting).
   - "cancelled"   = Batal (Brand menolak atau menyatakan belum ada budget ekspansi saat ini).
   - "deal"        = Deal (Brand menyetujui harga/paket kerjasama atau mengirim kontrak deal).
   - "completed"   = Selesai (Kampanye dan pembayaran dinyatakan telah tuntas).
2. Tentukan apakah brand meminta berhenti dihubungi (is_opt_out: boolean):
   - Set true jika brand membalas menolak keras, marah, meminta "unsubscribe", "remove me from list", "stop contacting", atau "not interested".
   - Jika is_opt_out === true, maka classified_status WAJIB "cancelled".
3. Tulis rangkuman 1 kalimat padat dalam Bahasa Indonesia (reply_summary, contoh: "Mereka minta Rate Card & tanya demografi audiens.").
4. Jika classified_status adalah "in_progress" atau "deal", susun draf balasan email berbahasa Inggris yang sopan, hangat, menyebutkan file PDF Media Kit telah dilampirkan, tanyakan objektif kampanye, dan tawarkan 3 opsi paket bundle (ai_draft_content).
`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT' as any,
            properties: {
              classified_status: {
                type: 'STRING' as any,
                enum: ['in_progress', 'cancelled', 'deal', 'completed'],
              },
              is_opt_out: { type: 'BOOLEAN' as any },
              reply_summary: { type: 'STRING' as any },
              ai_draft_content: { type: 'STRING' as any },
            },
            required: ['classified_status', 'reply_summary', 'ai_draft_content', 'is_opt_out'],
          },
        },
      });

      const parsedAi = JSON.parse(aiResponse.text || '{}');
      const isOptOut = Boolean(parsedAi.is_opt_out);
      let newStatus: 'in_progress' | 'cancelled' | 'deal' | 'completed' =
        parsedAi.classified_status || 'in_progress';
      
      if (isOptOut) {
        newStatus = 'cancelled';
      }

      const isPositive = !isOptOut && (newStatus === 'in_progress' || newStatus === 'deal');

      // 4. PENYUSUNAN DRAF GMAIL + LAMPIRAN FILE PDF MEDIA KIT (Hanya untuk positif)
      let draftId = null;
      if (isPositive && parsedAi.ai_draft_content) {
        try {
          const rawDraftWithPdf = createRawEmail({
            to: brand.primary_email,
            from: `${settings.sender_name} <${settings.sender_email}>`,
            subject: `Re: Partnership with ${brand.company_name}`,
            body: parsedAi.ai_draft_content,
            threadId: brand.gmail_thread_id,
            inReplyTo: messageIdHeader,
            references: messageIdHeader,
            attachmentPdf: mediaKitAttachment, // Lampirkan file PDF Media Kit!
          });

          const draftRes = await gmail.users.drafts.create({
            userId: 'me',
            requestBody: {
              message: {
                raw: rawDraftWithPdf,
                threadId: brand.gmail_thread_id,
              },
            },
          });
          draftId = draftRes.data.id;
          console.log(
            `[Tahap B3 - Gmail Draft + PDF] Draf balasan beserta lampiran ${mediaKitAttachment.filename} berhasil disiapkan (Draft ID: ${draftId})`
          );
        } catch (draftErr) {
          console.warn('[Tahap B3 - 05-inbox-watcher] Gagal membuat draf di Gmail:', draftErr);
        }
      }

      const newHistoryItem = {
        id: lastMessage.id || `msg_${Date.now()}`,
        direction: 'inbound' as const,
        subject: `Re: ${brand.company_name}`,
        snippet,
        sent_at: new Date().toISOString(),
      };

      // WAVE 1: Auto-Blacklist jika brand meminta Opt-Out
      if (isOptOut) {
        console.warn(`[Tahap B3 - Blacklist Guard] Brand ${brand.company_name} meminta Opt-Out! Otomatis blacklisted.`);
        await addExcludedBrand(brand.company_name, brand.domain, 'Permintaan Opt-Out / Unsubscribe dari brand');
      }

      // 5. STOP FOLLOW-UP OTOMATIS & UPDATE STATUS + replied_at DI SUPABASE
      if (isServerSupabaseConfigured()) {
        await supabaseServer
          .from('brands')
          .update({
            pipeline_status: newStatus,
            do_not_contact: isOptOut ? true : (brand.do_not_contact || false),
            replied_at: new Date().toISOString(), // WAVE 1: Timestamp balasan brand
            next_followup_at: null, // Stop Follow-Up Otomatis!
            reply_summary: parsedAi.reply_summary,
            ai_draft_ready: isPositive,
            ai_draft_content: isPositive ? parsedAi.ai_draft_content : null,
            gmail_draft_id: draftId,
            last_contacted_at: new Date().toISOString(),
            email_history: [...existingHistory, newHistoryItem],
            updated_at: new Date().toISOString(),
          })
          .eq('id', brand.id);
      }

      // 6. NOTIFIKASI LANGSUNG KE HP LEWAT BOT TELEGRAM
      let telegramSent = false;
      if (isOptOut) {
        await sendTelegramAlert(
          `⛔ <b>Brand Opt-Out: ${brand.company_name}</b>\n` +
          `Brand meminta berhenti dihubungi. Otomatis dimasukkan ke <b>Blacklist Permanen (do_not_contact = true)</b>.`,
          settings.telegram_chat_id
        );
      } else if (isPositive) {
        const telegramText =
          `🔥 Ada balasan positif dari <b>${brand.company_name} - ${brand.country}</b>!\n` +
          `Ringkasan: ${parsedAi.reply_summary}\n` +
          `Draf balasan + PDF sudah disiapkan di Gmail Anda, silakan cek dan klik Send.`;
        telegramSent = await sendTelegramAlert(telegramText, settings.telegram_chat_id);
      }

      detectedReplies.push({
        brand: brand.company_name,
        country: brand.country,
        status: newStatus,
        summary: parsedAi.reply_summary,
        draftCreatedWithPdf: !!draftId,
        pdfFilename: isPositive ? mediaKitAttachment.filename : null,
        telegramNotified: telegramSent,
      });
    } catch (e: any) {
      console.warn(`[Tahap B3 - 05-inbox-watcher] Error memeriksa thread ${brand.gmail_thread_id}:`, e.message);
    }
  }

  return {
    success: true,
    newRepliesCount: detectedReplies.length,
    message:
      detectedReplies.length > 0
        ? `[Tahap B3 Selesai] Mendeteksi ${detectedReplies.length} balasan brand! Jadwal follow-up dihentikan otomatis, Gmail Draft + PDF Media Kit telah disiapkan.`
        : '[Tahap B3 Selesai] Pemindaian inbox selesai. Belum ada balasan baru dari thread yang dipantau.',
    replies: detectedReplies,
  };
}
