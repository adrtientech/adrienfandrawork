import { GoogleGenAI } from '@google/genai';
import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import dotenv from 'dotenv';

dotenv.config();

export interface GenerateLinkedInPitchInput {
  brandId?: string;
  companyName: string;
  domain?: string;
  productSummary?: string;
  founderName?: string;
  primaryPicName?: string;
  primaryPicRole?: string;
  founderLinkedinUrl?: string;
  companyLinkedinUrl?: string;
  nicheCategory?: string;
  country?: string;
  customAngle?: string;
}

export interface LinkedInPitchResult {
  connectionNote: string; // Strictly <= 300 chars for LinkedIn Connection Request Note
  connectionNoteCharCount: number;
  inmailPitch: string;    // ~80-120 words for LinkedIn InMail / Direct Message Pitch
  followupNote: string;   // 2-3 sentences re-engagement note
  targetName: string;
  targetRole: string;
  targetLinkedinUrl: string;
  suggestedAngle: string;
  generatedAt: string;
}

/**
 * Nova (Agen C2 • Lead LinkedIn & Social Selling Specialist)
 * Men-generate draf pesan LinkedIn berkualitas tinggi:
 * 1. Connection Request Note (<= 300 karakter)
 * 2. InMail / Direct Message Social Selling Pitch (80-120 kata)
 * 3. Follow-Up Re-engagement Note
 */
export async function generateLinkedInPitch(
  input: GenerateLinkedInPitchInput
): Promise<LinkedInPitchResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil pengaturan kreator dari Supabase (jika tersedia)
  let senderName = 'Adrien Fandra';
  let creatorMetrics =
    '180,000+ tech-savvy community in Indonesia (software engineers, remote workers, high purchasing power).';
  let linkedinPromptDirective =
    'Focus on thought leadership, personal appreciation of product workflows, and relevant Southeast Asia tech expansion.';

  if (isServerSupabaseConfigured()) {
    try {
      const { data: st } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
      if (st) {
        if (st.sender_name) senderName = st.sender_name;
        if (st.creator_metrics) creatorMetrics = st.creator_metrics;
        if (st.dm_template_prompt) linkedinPromptDirective = st.dm_template_prompt;
      }
    } catch (err) {
      console.warn('[Nova LinkedIn] Gagal mengambil settings:', err);
    }
  }

  const targetName =
    input.founderName?.trim() ||
    input.primaryPicName?.trim() ||
    'Founder';

  const targetRole =
    input.primaryPicRole?.trim() ||
    (input.founderName ? 'Founder / CEO' : 'Head of Growth / Partnerships');

  const targetLinkedinUrl =
    input.founderLinkedinUrl?.trim() ||
    input.companyLinkedinUrl?.trim() ||
    'https://linkedin.com';

  const productContext =
    input.productSummary?.trim() ||
    `${input.companyName} software / tech platform`;

  const systemPrompt = `
Anda adalah "Nova" — Lead Follow-Up & LinkedIn Social Selling Specialist pribadi untuk kreator konten edukasi teknologi ${senderName}.
Profil Kreator:
- Nama: ${senderName}
- Audiens: ${creatorMetrics}
- Niche: Software development, AI productivity tools, dev workflows, developer education, & tech architecture di Indonesia.
- Gaya: Professional yet approachable, thought leader, non-salesy, peer-to-peer (founder to creator).

Pedoman Khusus LinkedIn Outreach:
${linkedinPromptDirective}

Target Prospek:
- Perusahaan: ${input.companyName} (${input.domain || ''})
- Negara: ${input.country || 'Global'}
- Kategori Niche: ${input.nicheCategory || 'Tech / SaaS'}
- Target PIC / Founder: ${targetName} (${targetRole})
- Profil Produk: ${productContext}
${input.customAngle ? `- Sudut Pandang Khusus yang Diminta Bos: ${input.customAngle}` : ''}

Tugas Anda menyusun 3 format draf pesan:

1. "connection_note" (CATATAN PERMINTAAN KONEKSI LINKEDIN):
   - ATURAN BAKU: Panjang teks WAJIB MAKSIMAL 290 KARAKTER (LinkedIn memiliki batas keras 300 karakter).
   - Nada: Hangat, personal, sebut nama target (${targetName}) dan produk (${input.companyName}).
   - Hook: Sebutkan bahwa Anda mengikuti perkembangan produk mereka dari Indonesia dan mengedukasi developer/tech community di sini.
   - Tanpa link, tanpa hard-sell. Tujuannya murni agar permintaan koneksi diterima (accept rate tinggi).

2. "inmail_pitch" (PESAN INMAIL / DIRECT MESSAGE SOCIAL SELLING):
   - Panjang: Sekitar 75 - 110 kata (maksimal 3 paragraf pendek).
   - Paragraf 1: Pengamatan tajam & apresiasi terhadap UX/fitur ${input.companyName}.
   - Paragraf 2: Ide konten konkret untuk mengenalkan produk ke 180k+ engineer & tech professionals di Indonesia (contoh: workflow tutorial / deep dive architecture).
   - Paragraf 3: Call-to-action santai tanpa paksaan (contoh: "Open to seeing a 1-page audience breakdown or async chat?").

3. "followup_note" (PESAN PENGINGAT SINGKAT):
   - 2 kalimat santai jika koneksi diterima atau follow-up pesan sebelumnya.

Format Keluaran WAJIB berupa JSON murni:
{
  "connection_note": "Teks pesan undangan koneksi (HARUS <= 290 karakter)",
  "inmail_pitch": "Teks pesan InMail/DM (75-110 kata)...",
  "followup_note": "Teks follow-up 2 kalimat...",
  "suggested_angle": "1 kalimat ringkasan sudut pandang pitching..."
}
`;

  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ];

  let rawJson = '';
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        rawJson = response.text.trim();
        console.log(`[Nova LinkedIn] Sukses di-generate oleh model: ${model}`);
        break;
      }
    } catch (err: any) {
      console.warn(`[Nova LinkedIn] Model ${model} gagal: ${err?.message || err}`);
      lastError = err;
    }
  }

  if (!rawJson) {
    throw lastError || new Error('Gagal memproses draf LinkedIn via Gemini');
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch (parseErr) {
    console.error('[Nova LinkedIn] Gagal parse JSON Gemini:', parseErr);
  }

  let connectionNote = (parsed.connection_note || '').trim();
  // Validasi batas keras LinkedIn 300 karakter
  if (!connectionNote) {
    connectionNote = `Hi ${targetName}! Huge fan of what you're building with ${input.companyName}. Following from Indonesia where I create tech & dev education for 180k+ engineers. Would love to connect and share a few ideas on your SEA reach!`;
  }
  if (connectionNote.length > 298) {
    connectionNote = connectionNote.slice(0, 295) + '...';
  }

  const inmailPitch =
    (parsed.inmail_pitch || '').trim() ||
    `Hi ${targetName},\n\nReally impressed by ${input.companyName} and how it streamlines workflows for technical teams. Following your growth closely from Indonesia.\n\nI run a 180k+ tech & software engineering community here, educating developers and productivity-focused professionals. We're putting together a deep-dive breakdown on modern tools and would love to showcase ${input.companyName} as a best-in-class solution.\n\nHappy to share our 1-page demographic kit or a quick concept if SEA creator partnerships are on your radar this quarter!`;

  const followupNote =
    (parsed.followup_note || '').trim() ||
    `Hi ${targetName}, bumping this gently! Would love to share a quick 1-page audience breakdown for ${input.companyName} whenever you have a moment.`;

  const suggestedAngle =
    parsed.suggested_angle ||
    `Workflow tutorial & developer productivity case study tailored for Indonesian tech talent.`;

  // Simpan hasil ke Supabase jika brandId ada
  if (input.brandId && isServerSupabaseConfigured()) {
    try {
      await supabaseServer
        .from('brands')
        .update({
          dm_fallback_message: inmailPitch,
          outreach_channel: 'dm_founder',
          notes: `[Nova LinkedIn Draf] Ter-generate Connection Note (${connectionNote.length} kar) & InMail Pitch. Target: ${targetName}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.brandId);
    } catch (dbErr) {
      console.warn('[Nova LinkedIn] Gagal update Supabase brand:', dbErr);
    }
  }

  return {
    connectionNote,
    connectionNoteCharCount: connectionNote.length,
    inmailPitch,
    followupNote,
    targetName,
    targetRole,
    targetLinkedinUrl,
    suggestedAngle,
    generatedAt: new Date().toISOString(),
  };
}
