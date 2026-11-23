import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { getGmailClient, isGmailConfigured, createRawEmail } from '../gmail-client.js';
import { searchSerper } from './02-enrichment.js';
import { verifyEmailBounceShield } from './03-verifier.js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * TAHAP C1 & C2: Follow-Up Berjenjang & Pelarian ke Jalur Alternatif / Fallback (06-followup.ts)
 * - Follow-Up 1 (Hari ke-4): Email balasan singkat 3–4 kalimat di dalam utas (thread) email yang sama (bump thread) -> status 'followup_1'.
 * - Follow-Up 2 / Value Drop (Hari ke-9): 1x follow-up terakhir dengan bocoran ide konten konkret + kalimat penutup tanpa paksaan -> status 'followup_2'.
 * - Pindah ke Jalur Alternatif (Hari ke-14): Berhenti mengirim email ke alamat lama:
 *     * Jika brand berskala Besar ('enterprise'): Otomatis mencari alamat email PIC ke-2 di perusahaan yang sama
 *       (misal dari Marketing Manager ke Partnership Lead) dan memulai siklus baru.
 *     * Jika brand berskala Baru Mulai ('startup') / Menengah ('mid_market'): Mengubah status menjadi 'fallback_dm' (Pindah ke DM Founder),
 *       menyusun draf pesan singkat 2 kalimat di database lengkap dengan tautan klik langsung ke Instagram/LinkedIn Founder.
 */
export async function runFollowupAgent(): Promise<{
  success: boolean;
  followupSentCount: number;
  enterpriseSecondPicCount: number;
  fallbackDmCount: number;
  message: string;
  results: any[];
}> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil settings
  let settings: any = {
    is_global_paused: false,
    followup_1_delay_days: 4,
    followup_2_delay_days: 5,
    fallback_delay_days: 5,
    sender_name: 'Adrien Fandra',
    sender_email: process.env.GMAIL_USER_EMAIL || 'adrien@yourdomain.co',
    dm_template_prompt:
      'Write a casual 2-sentence Instagram/LinkedIn DM directly to the founder referencing the email just sent and sharing one quick angle for introducing their product to an Indonesian audience.',
  };

  if (isServerSupabaseConfigured()) {
    const { data: dbSettings } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
    if (dbSettings) settings = { ...settings, ...dbSettings };
  }

  if (settings.is_global_paused) {
    return {
      success: false,
      followupSentCount: 0,
      enterpriseSecondPicCount: 0,
      fallbackDmCount: 0,
      message: 'Engine sedang dijeda (is_global_paused = true). Follow-up ditunda.',
      results: [],
    };
  }

  // 2. Ambil brand yang jatuh tempo follow-up (next_followup_at <= NOW())
  const nowIso = new Date().toISOString();
  let dueBrands: any[] = [];

  if (isServerSupabaseConfigured()) {
    const { data: brands, error } = await supabaseServer
      .from('brands')
      .select('*')
      .in('pipeline_status', ['cold_sent', 'followup_1', 'followup_2'])
      .lte('next_followup_at', nowIso)
      .limit(6);

    if (error) {
      throw new Error(`Gagal mengambil brand follow-up dari Supabase: ${error.message}`);
    }
    dueBrands = brands || [];
  }

  if (dueBrands.length === 0) {
    return {
      success: true,
      followupSentCount: 0,
      enterpriseSecondPicCount: 0,
      fallbackDmCount: 0,
      message: 'Tidak ada brand yang jatuh tempo Follow-Up (H+4 / H+9 / H+14) saat ini.',
      results: [],
    };
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
  const gmail = isGmailConfigured() ? getGmailClient() : null;
  const isSafeTestMode = process.env.SAFE_TEST_MODE === 'true';
  const testRecipient = process.env.TEST_RECIPIENT_EMAIL || settings.sender_email;

  const results: any[] = [];
  let followupsSent = 0;
  let enterpriseSecondPicCount = 0;
  let fallbackCount = 0;

  for (const brand of dueBrands) {
    console.log(
      `[Tahap C1-C2 - 06-followup] Memproses: ${brand.company_name} (Status: ${brand.pipeline_status}, Skala: ${brand.company_scale})`
    );

    // =========================================================================
    // TAHAP C1-A: Follow-Up 1 (Hari ke-4) — Bump Thread (3-4 Kalimat)
    // =========================================================================
    if (brand.pipeline_status === 'cold_sent') {
      const delayDays = settings.followup_2_delay_days || 5; // Menuju Hari ke-9

      const prompt = `
Anda adalah kreator konten teknologi & edukasi ${settings.sender_name} (180k+ audiens di Indonesia).
Tugas (Tahap C1 - Follow-Up 1 Hari ke-4):
Tulis email balasan singkat TEPAT 3–4 KALIMAT berbahasa Inggris di dalam utas (thread) yang sama untuk menaikkan pesan pertama ke urutan atas kotak masuk ${brand.primary_pic_name || 'Partnership Team'} dari ${brand.company_name}.
Fokus: Menanyakan secara sopan apakah mereka sempat melihat ide kolaborasi edukasi produk "${brand.product_summary}" untuk pasar Indonesia, dan tawarkan berbagi data demografi audiens.
Jangan gunakan subjek baru, langsung tulis isi body email (3-4 kalimat saja).
`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const followUpBody =
          response.text?.trim() ||
          `Hi ${brand.primary_pic_name || 'team'}, bumping this gently to the top of your inbox in case it got buried. We’re planning our upcoming Indonesian tech & productivity content calendar and would love to feature ${brand.company_name}. Happy to send over our 1-page audience demographics if helpful!`;

        const lastSubject =
          (Array.isArray(brand.email_history) && brand.email_history[0]?.subject) ||
          `Partnership with ${brand.company_name}`;
        const replySubject = lastSubject.startsWith('Re:') ? lastSubject : `Re: ${lastSubject}`;

        if (gmail && brand.gmail_thread_id) {
          const actualRecipient = isSafeTestMode ? testRecipient : brand.primary_email;
          const raw = createRawEmail({
            to: actualRecipient,
            from: `${settings.sender_name} <${settings.sender_email}>`,
            subject: isSafeTestMode ? `[TEST FOLLOW-UP 1 (H+4)] ${replySubject}` : replySubject,
            body: followUpBody,
            threadId: brand.gmail_thread_id,
          });

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw,
              threadId: brand.gmail_thread_id,
            },
          });
        }

        const nextFollowupDate = new Date();
        nextFollowupDate.setDate(nextFollowupDate.getDate() + delayDays);

        const historyItem = {
          id: `msg_fu1_${Date.now()}`,
          direction: 'outbound' as const,
          subject: replySubject,
          snippet: followUpBody.slice(0, 120),
          sent_at: new Date().toISOString(),
        };

        const existingHistory = Array.isArray(brand.email_history) ? brand.email_history : [];

        if (isServerSupabaseConfigured()) {
          await supabaseServer
            .from('brands')
            .update({
              pipeline_status: 'followup_1',
              last_contacted_at: new Date().toISOString(),
              next_followup_at: nextFollowupDate.toISOString(),
              followup_count: 1,
              email_history: [...existingHistory, historyItem],
              updated_at: new Date().toISOString(),
            })
            .eq('id', brand.id);
        }

        followupsSent++;
        results.push({ brand: brand.company_name, action: 'followup_1_sent (Hari ke-4 Bump Thread)' });
      } catch (err: any) {
        console.error(`[Tahap C1 - Follow-Up 1] Error pada ${brand.company_name}:`, err.message);
      }
    }

    // =========================================================================
    // TAHAP C1-B: Follow-Up 2 / Value Drop (Hari ke-9) — Bocoran Ide Konten Konkret
    // =========================================================================
    else if (brand.pipeline_status === 'followup_1') {
      const delayDays = settings.fallback_delay_days || 5; // Menuju Hari ke-14
      const concreteIdea =
        (Array.isArray(brand.suggested_content_ideas) && brand.suggested_content_ideas[0]) ||
        `Studi kasus tutorial penggunaan ${brand.company_name} untuk melipatgandakan produktivitas kerja remote di Indonesia`;

      const prompt = `
Anda adalah kreator konten ${settings.sender_name} (180k+ audiens di Indonesia).
Tugas (Tahap C1 - Follow-Up 2 / Value Drop Hari ke-9):
Tulis 1 kali email follow-up terakhir (maksimal 65 kata) berbahasa Inggris di dalam utas yang sama ke ${brand.primary_pic_name || 'Team'} dari ${brand.company_name}.
Wajib Memuat:
1. "Value Drop": Berikan bocoran ide konten konkret yang sudah kami siapkan khusus untuk brand mereka: "${concreteIdea}".
2. Tutup dengan kalimat ramah tanpa paksaan (no-pressure breakup sentence, bahwa ini adalah email terakhir ke alamat ini dan pintu kolaborasi selalu terbuka kapan pun mereka ekspansi ke Asia Tenggara).
`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const valueDropBody =
          response.text?.trim() ||
          `Hi ${brand.primary_pic_name || 'there'}, sharing one quick content concept before I close this thread: "${concreteIdea}" tailored for our 180k+ Indonesian audience. No rush at all if your Q1/Q2 creator calendar is currently full—I won't flood your inbox further, and feel free to reach out anytime SEA expansion is on your radar!`;

        const lastSubject =
          (Array.isArray(brand.email_history) && brand.email_history[0]?.subject) ||
          `Partnership with ${brand.company_name}`;
        const replySubject = lastSubject.startsWith('Re:') ? lastSubject : `Re: ${lastSubject}`;

        if (gmail && brand.gmail_thread_id) {
          const actualRecipient = isSafeTestMode ? testRecipient : brand.primary_email;
          const raw = createRawEmail({
            to: actualRecipient,
            from: `${settings.sender_name} <${settings.sender_email}>`,
            subject: isSafeTestMode ? `[TEST FOLLOW-UP 2 / VALUE DROP (H+9)] ${replySubject}` : replySubject,
            body: valueDropBody,
            threadId: brand.gmail_thread_id,
          });

          await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw,
              threadId: brand.gmail_thread_id,
            },
          });
        }

        const nextFollowupDate = new Date();
        nextFollowupDate.setDate(nextFollowupDate.getDate() + delayDays);

        const historyItem = {
          id: `msg_fu2_${Date.now()}`,
          direction: 'outbound' as const,
          subject: replySubject,
          snippet: `[VALUE DROP] ${valueDropBody.slice(0, 110)}`,
          sent_at: new Date().toISOString(),
        };

        const existingHistory = Array.isArray(brand.email_history) ? brand.email_history : [];

        if (isServerSupabaseConfigured()) {
          await supabaseServer
            .from('brands')
            .update({
              pipeline_status: 'followup_2',
              last_contacted_at: new Date().toISOString(),
              next_followup_at: nextFollowupDate.toISOString(),
              followup_count: 2,
              email_history: [...existingHistory, historyItem],
              updated_at: new Date().toISOString(),
            })
            .eq('id', brand.id);
        }

        followupsSent++;
        results.push({ brand: brand.company_name, action: 'followup_2_value_drop_sent (Hari ke-9)' });
      } catch (err: any) {
        console.error(`[Tahap C1 - Follow-Up 2] Error pada ${brand.company_name}:`, err.message);
      }
    }

    // =========================================================================
    // TAHAP C2: Pindah ke Jalur Alternatif (Hari ke-14)
    // - Berhenti mengirim email ke alamat pertama.
    // - Cabang Skala Besar ('enterprise'): Cari email PIC ke-2 & mulai siklus baru.
    // - Cabang Skala Baru Mulai ('startup') / Menengah ('mid_market'): Pindah ke DM Founder (2 kalimat + link IG/LinkedIn).
    // =========================================================================
    else if (brand.pipeline_status === 'followup_2') {
      const alreadyRotated = (brand.notes || '').includes('[ROTASI PIC KE-2]');

      // CABANG 1: Brand Skala Besar (enterprise) & belum pernah rotasi PIC ke-2
      if (brand.company_scale === 'enterprise' && !alreadyRotated) {
        console.log(
          `[Tahap C2 - Hari ke-14 Enterprise] ${brand.company_name} berskala BESAR. Mencari alamat email PIC ke-2 (Partnership Lead / Creator Lead)...`
        );

        let secondPicEmail = brand.alternate_email;
        let secondPicName = 'Partnership Lead';
        let secondPicRole = 'Global Creator & Partnership Lead';

        if (!secondPicEmail || secondPicEmail === brand.primary_email) {
          const searchSnippets = await searchSerper(
            `"${brand.company_name}" OR "${brand.domain}" ("Partnership Lead" OR "Influencer Marketing" OR "Creator Partnerships" OR "Head of Growth") site:linkedin.com/in/`,
            5
          );

          try {
            const picRes = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Temukan PIC ke-2 (berbeda dari ${brand.primary_pic_name || ''} / ${brand.primary_email || ''}) untuk kemitraan kreator di perusahaan skala besar ${brand.company_name} (${brand.domain}).
Hasil Pencarian:
${searchSnippets || 'Tidak ada'}
Berikan JSON: second_pic_name, second_pic_role, second_pic_email (gunakan email departemen resmi seperti partnerships@${brand.domain} atau creators@${brand.domain} jika email personal tidak tercantum, asalkan berbeda dari ${brand.primary_email}).`,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT' as any,
                  properties: {
                    second_pic_name: { type: 'STRING' as any },
                    second_pic_role: { type: 'STRING' as any },
                    second_pic_email: { type: 'STRING' as any },
                  },
                  required: ['second_pic_name', 'second_pic_role', 'second_pic_email'],
                },
              },
            });
            const parsedPic = JSON.parse(picRes.text || '{}');
            if (parsedPic.second_pic_email && parsedPic.second_pic_email !== brand.primary_email) {
              secondPicEmail = parsedPic.second_pic_email.toLowerCase().trim();
              secondPicName = parsedPic.second_pic_name || secondPicName;
              secondPicRole = parsedPic.second_pic_role || secondPicRole;
            }
          } catch {}
        }

        // Verifikasi email PIC ke-2 dengan Bounce Shield
        const isSecondValid =
          secondPicEmail &&
          secondPicEmail !== brand.primary_email &&
          (await verifyEmailBounceShield(secondPicEmail)).isValid;

        if (isSecondValid && secondPicEmail) {
          if (isServerSupabaseConfigured()) {
            await supabaseServer
              .from('brands')
              .update({
                primary_pic_name: secondPicName,
                primary_pic_role: secondPicRole,
                primary_email: secondPicEmail,
                alternate_email: brand.primary_email, // Simpan email lama sebagai arsip
                email_verified: true,
                pipeline_status: 'enriched', // Memulai siklus baru di Tahap B1 (04-outreach.ts)
                gmail_thread_id: null,
                gmail_message_id: null,
                next_followup_at: null,
                followup_count: 0,
                notes: `[ROTASI PIC KE-2 - Hari ke-14] Pindah dari ${brand.primary_email} ke PIC ke-2: ${secondPicName} (${secondPicEmail}) untuk memulai siklus baru.`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', brand.id);
          }

          enterpriseSecondPicCount++;
          results.push({
            brand: brand.company_name,
            action: `Rotasi ke PIC ke-2 Enterprise (${secondPicEmail}) & mulai siklus baru`,
          });
          continue;
        }
      }

      // CABANG 2: Brand Skala Baru Mulai ('startup') / Menengah ('mid_market') (atau Fallback Enterprise)
      // -> Ubah status menjadi 'fallback_dm' (Pindah ke DM Founder) + draf DM 2 kalimat + link IG/LinkedIn Founder
      console.log(
        `[Tahap C2 - Hari ke-14] ${brand.company_name} hening setelah 2x follow-up. Mengubah status ke Pindah ke DM Founder (fallback_dm).`
      );

      const prompt = `
Sistem Prompt DM Founder (Tahap C2 Blueprint - Hari ke-14):
${settings.dm_template_prompt}

Data Founder: ${brand.founder_name || brand.primary_pic_name || 'Founder'} (${brand.company_name})
Produk: ${brand.product_summary}
Kreator: ${settings.sender_name} (180k+ audiens teknologi & bisnis di Indonesia)

Aturan Wajib:
- Tulis TEPAT 2 KALIMAT singkat, santai, personal dalam Bahasa Inggris untuk dikirim via DM Instagram / LinkedIn one-on-one ke sang Founder.
- Kalimat 1: Sebutkan apresiasi singkat pada produk ${brand.company_name} dan bahwa Anda sempat mengirim ide kolaborasi lewat email.
- Kalimat 2: Tawarkan 1 sudut pandang cepat memperkenalkan produk mereka ke audiens Indonesia tanpa kesan memaksa.
`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const dmMessage =
          response.text?.trim() ||
          `Hi ${brand.founder_name || 'there'}, huge fan of what you’re building with ${brand.company_name} and dropped a quick note to your team's inbox earlier! Would love to share a quick concept on introducing ${brand.company_name} to our 180k+ tech-savvy audience in Indonesia whenever you have a moment.`;

        if (isServerSupabaseConfigured()) {
          await supabaseServer
            .from('brands')
            .update({
              pipeline_status: 'fallback_dm', // Pindah ke DM Founder
              outreach_channel: 'dm_founder',
              dm_fallback_message: dmMessage,
              next_followup_at: null,
              notes: `[Tahap C2 - Hari ke-14] 2x Follow-Up hening. Berhenti kirim email & dialihkan ke jalur one-on-one DM Founder (${brand.founder_name || 'Founder'}).`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', brand.id);
        }

        fallbackCount++;
        results.push({
          brand: brand.company_name,
          action: 'Pindah ke DM Founder (Hari ke-14)',
          founder: brand.founder_name,
          instagram: brand.founder_instagram_url,
          linkedin: brand.founder_linkedin_url,
        });
      } catch (err: any) {
        console.error(`[Tahap C2 - DM Founder] Error pada ${brand.company_name}:`, err.message);
      }
    }
  }

  return {
    success: true,
    followupSentCount: followupsSent,
    enterpriseSecondPicCount,
    fallbackDmCount: fallbackCount,
    message: `[Tahap C1 & C2 Selesai] ${followupsSent} follow-up terkirim, ${enterpriseSecondPicCount} brand Skala Besar dirotasi ke PIC ke-2, ${fallbackCount} brand Startup/Menengah dialihkan ke Pindah ke DM Founder.`,
    results,
  };
}
