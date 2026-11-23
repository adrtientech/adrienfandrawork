import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { GoogleGenAI } from '@google/genai';
import { fetchWithJina, searchSerper } from './02-enrichment.js';
import dns from 'dns/promises';
import dotenv from 'dotenv';

dotenv.config();

const DISPOSABLE_OR_INVALID_DOMAINS = new Set([
  'example.com',
  'test.com',
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'sentry.io',
  'wixpress.com',
]);

const BOUNCE_TRAP_PREFIXES = [
  'noreply@',
  'no-reply@',
  'donotreply@',
  'do-not-reply@',
  'mailer-daemon@',
  'postmaster@',
  'bounce@',
  'abuse@',
  'privacy@',
  'legal@',
  'security@',
  'dmca@',
];

/**
 * PENGAMAN TEKNIS #1: Detektor Email Mental (Bounce Shield)
 * Lapis 1: Validasi sintaks RFC, filter jebakan no-reply, & disposable domain
 * Lapis 2: DNS MX Record Check (memastikan mail server domain hidup & menerima email)
 * Lapis 3: Verifalia API Deep Mailbox Check (opsional jika VERIFALIA_USERNAME & VERIFALIA_PASSWORD tersedia di .env)
 */
export async function verifyEmailBounceShield(email: string): Promise<{
  isValid: boolean;
  method: string;
  reason: string;
}> {
  if (!email || typeof email !== 'string') {
    return { isValid: false, method: 'syntax', reason: 'Alamat email kosong' };
  }

  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleaned)) {
    return { isValid: false, method: 'syntax', reason: 'Format sintaks email tidak valid' };
  }

  if (BOUNCE_TRAP_PREFIXES.some((prefix) => cleaned.startsWith(prefix))) {
    return { isValid: false, method: 'bounce_trap_filter', reason: 'Alamat no-reply / trap yang memicu hard bounce' };
  }

  const parts = cleaned.split('@');
  const domain = parts[1];
  if (!domain || DISPOSABLE_OR_INVALID_DOMAINS.has(domain)) {
    return { isValid: false, method: 'domain_blacklist', reason: 'Domain disposable atau placeholder' };
  }

  // Lapis 2: DNS MX Record Check
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { isValid: false, method: 'dns_mx', reason: `Domain ${domain} tidak memiliki DNS MX Record aktif` };
    }
  } catch {
    return { isValid: false, method: 'dns_mx', reason: `Gagal resolusi DNS MX untuk domain ${domain} (domain mati)` };
  }

  // Lapis 3: Verifalia API Check (Jika dikonfigurasi di .env)
  const verifaliaUser = process.env.VERIFALIA_USERNAME;
  const verifaliaPass = process.env.VERIFALIA_PASSWORD;

  if (verifaliaUser && verifaliaPass) {
    try {
      const authHeader = Buffer.from(`${verifaliaUser}:${verifaliaPass}`).toString('base64');
      const vRes = await fetch('https://api.verifalia.com/v2.6/email-validations?waitTime=5000', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries: [{ inputData: cleaned }],
        }),
      });

      if (vRes.ok) {
        const vData = await vRes.json();
        const entry = vData?.entries?.data?.[0];
        if (entry && entry.classification) {
          const isDeliverable = entry.classification === 'Deliverable' || entry.classification === 'Risky';
          return {
            isValid: isDeliverable,
            method: 'dns_mx + verifalia_api',
            reason: `Verifalia Classification: ${entry.classification} (${entry.status || 'Verified'})`,
          };
        }
      }
    } catch (vErr: any) {
      console.warn('[Tahap A4 - Verifalia] Fallback ke DNS MX karena API timeout/error:', vErr.message);
    }
  }

  return {
    isValid: true,
    method: 'dns_mx + bounce_shield',
    reason: `DNS MX Record aktif untuk ${domain} & bebas dari filter bounce trap (<3% bounce protection)`,
  };
}

/**
 * TAHAP A4: Ekstraksi Kontak, Pisah Jalur Telepon, & Verifikasi Anti-Bounce (03-verifier.ts)
 * - Mencari kontak dari halaman website atau API pencari email.
 * - Aturan Penahanan Nomor Telepon/WA: Jika ditemukan nomor telepon langsung atau WhatsApp tim marketing,
 *   ubah outreach_channel -> 'manual_phone_wa' dan pipeline_status -> 'ready_manual' (Siap Dihubungi Manual).
 * - Tameng Verifikasi Email (Bounce Shield): Cek DNS MX Record & API Verifalia.
 *   Jika valid -> email_verified = true (Siap Outreach).
 *   Jika invalid -> tahan pengiriman agar hard bounce < 3%.
 */
export async function runVerifierAgent(batchSize = 4): Promise<{
  success: boolean;
  verifiedEmailCount: number;
  manualPhoneHeldCount: number;
  invalidBlockedCount: number;
  message: string;
  results: any[];
}> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // Ambil brand yang sudah melewati Tahap A2/A3 (status 'enriched') namun belum diverifikasi kontaknya
  let targetBrands: any[] = [];

  if (isServerSupabaseConfigured()) {
    const { data: brands, error } = await supabaseServer
      .from('brands')
      .select('*')
      .eq('pipeline_status', 'enriched')
      .eq('email_verified', false)
      .limit(batchSize);

    if (error) {
      throw new Error(`Gagal mengambil brand untuk Tahap A4 dari Supabase: ${error.message}`);
    }
    targetBrands = brands || [];
  }

  if (targetBrands.length === 0) {
    return {
      success: true,
      verifiedEmailCount: 0,
      manualPhoneHeldCount: 0,
      invalidBlockedCount: 0,
      message: 'Semua brand berstatus "enriched" sudah melewati Tameng Verifikasi Tahap A4.',
      results: [],
    };
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
  let verifiedEmailCount = 0;
  let manualPhoneHeldCount = 0;
  let invalidBlockedCount = 0;
  const results: any[] = [];

  for (const brand of targetBrands) {
    console.log(`[Tahap A4 - 03-verifier] Ekstraksi Kontak & Bounce Shield: ${brand.company_name} (${brand.domain})`);

    const baseUrl = brand.website_url || `https://${brand.domain}`;
    const [contactPageText, contactSearchSnippets] = await Promise.all([
      fetchWithJina(`${baseUrl.replace(/\/$/, '')}/contact`, 2500),
      searchSerper(
        `"${brand.domain}" ("@${brand.domain}" OR "partnerships@" OR "marketing@" OR "press@" OR "hello@" OR "whatsapp" OR "phone")`,
        6
      ),
    ]);

    const prompt = `
Anda adalah Contact Extraction & Anti-Bounce Specialist (Tahap A4 Blueprint).
Tugas Anda: Ekstrak kontak resmi tim marketing / partnership dari brand "${brand.company_name}" (Domain: ${brand.domain}).

Data Halaman Contact & Hasil Pencarian:
- Halaman /contact:
${contactPageText || 'Tidak tersedia'}
- Hasil Pencarian Kontak & Email (Serper):
${contactSearchSnippets || 'Tidak tersedia'}
- Data Saat Ini:
  PIC: ${brand.primary_pic_name || 'N/A'} (${brand.primary_pic_role || 'N/A'})
  Email Saat Ini: ${brand.primary_email || 'Belum ada'}
  Telepon/WA Saat Ini: ${brand.marketing_phone || 'Belum ada'}

Instruksi Ekstraksi:
1. Cari apakah ada Nomor Telepon Langsung atau WhatsApp Tim Marketing/Partnership (marketing_phone).
   HANYA isi marketing_phone jika benar-benar ditemukan nomor telepon/WA valid di teks (format internasional misal +65..., +1..., +44...). Jika tidak ada, kosongkan ("").
2. Cari alamat email utama untuk kemitraan/marketing (primary_email, contoh: partnerships@${brand.domain}, marketing@${brand.domain}, press@${brand.domain}, atau email PIC langsung).
   JANGAN pernah menggunakan noreply@ atau donotreply@.
3. Cari juga alamat email cadangan / PIC ke-2 di perusahaan yang sama jika ada (alternate_email, misal hello@${brand.domain} atau creator@${brand.domain}).
`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT' as any,
            properties: {
              primary_email: { type: 'STRING' as any },
              alternate_email: { type: 'STRING' as any },
              marketing_phone: { type: 'STRING' as any },
              primary_pic_name: { type: 'STRING' as any },
              primary_pic_role: { type: 'STRING' as any },
            },
          },
        },
      });

      const extracted = JSON.parse(response.text || '{}');

      const rawPhone = (extracted.marketing_phone || brand.marketing_phone || '').trim();
      const hasValidPhone = rawPhone.length >= 8 && /\d{6,}/.test(rawPhone);

      const candidateEmail = (
        extracted.primary_email ||
        brand.primary_email ||
        `partnerships@${brand.domain}`
      )
        .trim()
        .toLowerCase();

      const candidateAltEmail = (extracted.alternate_email || brand.alternate_email || '').trim().toLowerCase() || null;

      // ATURAN 1 (Tahap A4): Penahanan Nomor Telepon / WA
      if (hasValidPhone) {
        manualPhoneHeldCount++;
        console.log(
          `[Tahap A4 - Pisah Jalur WA] Nomor telepon/WA ditemukan untuk ${brand.company_name} (${rawPhone}) -> Ditahan ke Manual_Phone_WA (Siap Dihubungi Manual).`
        );

        const updates = {
          marketing_phone: rawPhone,
          primary_email: candidateEmail || brand.primary_email,
          alternate_email: candidateAltEmail,
          outreach_channel: 'manual_phone_wa',
          pipeline_status: 'ready_manual',
          notes: `[Tahap A4] Nomor Telepon/WA Marketing ditemukan (${rawPhone}). Email otomatis ditahan agar Anda dapat menghubungi langsung.`,
          updated_at: new Date().toISOString(),
        };

        if (isServerSupabaseConfigured()) {
          await supabaseServer.from('brands').update(updates).eq('id', brand.id);
        }

        results.push({ brand: brand.company_name, action: 'manual_phone_wa', phone: rawPhone });
        continue;
      }

      // ATURAN 2 (Tahap A4): Tameng Verifikasi Email (Bounce Shield)
      const shieldResult = await verifyEmailBounceShield(candidateEmail);

      if (shieldResult.isValid) {
        verifiedEmailCount++;
        console.log(
          `[Tahap A4 - Bounce Shield LULUS] ${candidateEmail} TERVERIFIKASI (${shieldResult.method}: ${shieldResult.reason})`
        );

        const updates = {
          primary_email: candidateEmail,
          alternate_email: candidateAltEmail,
          email_verified: true,
          primary_pic_name: extracted.primary_pic_name || brand.primary_pic_name,
          primary_pic_role: extracted.primary_pic_role || brand.primary_pic_role,
          outreach_channel: 'email_auto',
          pipeline_status: 'enriched', // Siap dikirim oleh 04-outreach.ts (email_verified = true)
          notes: `[Tahap A4 Bounce Shield: VALID] ${shieldResult.reason}`,
          updated_at: new Date().toISOString(),
        };

        if (isServerSupabaseConfigured()) {
          await supabaseServer.from('brands').update(updates).eq('id', brand.id);
        }

        results.push({
          brand: brand.company_name,
          action: 'email_verified',
          email: candidateEmail,
          verification: shieldResult,
        });
      } else {
        // Email Mental / Invalid! Blokir pengiriman agar hard bounce < 3%
        invalidBlockedCount++;
        console.warn(
          `[Tahap A4 - Bounce Shield BLOKIR] Email ${candidateEmail} TIDAK AKTIF (${shieldResult.reason}) -> Diblokir untuk melindungi reputasi akun Google.`
        );

        // Jika Startup/Menengah dan memiliki kontak Founder, alihkan ke DM Founder; jika tidak, tandai skipped
        const hasFounderSocial = !!(brand.founder_linkedin_url || brand.founder_instagram_url || brand.founder_name);
        const fallbackStatus = hasFounderSocial ? 'fallback_dm' : 'skipped';
        const fallbackChannel = hasFounderSocial ? 'dm_founder' : 'email_auto';

        const updates = {
          primary_email: candidateEmail,
          alternate_email: candidateAltEmail,
          email_verified: false,
          outreach_channel: fallbackChannel,
          pipeline_status: fallbackStatus,
          notes: `[Tahap A4 Bounce Shield: DIBLOKIR] Email ${candidateEmail} invalid (${shieldResult.reason}). Ditolak untuk menjaga bounce rate < 3%.`,
          updated_at: new Date().toISOString(),
        };

        if (isServerSupabaseConfigured()) {
          await supabaseServer.from('brands').update(updates).eq('id', brand.id);
        }

        results.push({
          brand: brand.company_name,
          action: 'blocked_invalid_email',
          email: candidateEmail,
          fallbackStatus,
          reason: shieldResult.reason,
        });
      }
    } catch (err: any) {
      console.error(`[Tahap A4 - 03-verifier] Error pada ${brand.company_name}:`, err.message);
    }
  }

  return {
    success: true,
    verifiedEmailCount,
    manualPhoneHeldCount,
    invalidBlockedCount,
    message: `[Tahap A4 Selesai] ${verifiedEmailCount} email lolos Bounce Shield, ${manualPhoneHeldCount} dialihkan ke Manual Phone/WA, ${invalidBlockedCount} email mati diblokir (<3% Bounce Protection).`,
    results,
  };
}
