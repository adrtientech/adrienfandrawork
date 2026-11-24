import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { isBrandExcluded } from '../excluded-brands.js';
import { cleanBrandName } from './01-discovery.js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Membaca halaman web (Homepage / About Us) menjadi teks bersih menggunakan Jina Reader (https://r.jina.ai/...)
 */
export async function fetchWithJina(url: string, maxChars = 3500): Promise<string> {
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;
  const jinaEndpoint = `https://r.jina.ai/${targetUrl}`;
  const headers: Record<string, string> = {
    Accept: 'text/plain',
  };
  if (process.env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(jinaEndpoint, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return '';
    const text = await res.text();
    return text.slice(0, maxChars);
  } catch {
    clearTimeout(timeoutId);
    return '';
  }
}

/**
 * Pencarian terfokus melalui Serper API (Google Search)
 */
export async function searchSerper(query: string, num = 5): Promise<string> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return '';
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data.organic || [])
      .map((item: any) => `${item.title}: ${item.snippet} (${item.link})`)
      .join('\n');
  } catch {
    return '';
  }
}

/**
 * TAHAP A2 & A3: Investigasi Web, Klasifikasi Skala, Lacak Pemilik, & AI Lead Scoring (02-enrichment.ts)
 * - Mengambil daftar brand berstatus 'discovered'.
 * - Membaca halaman utama & About Us via Jina Reader (https://r.jina.ai/...).
 * - Klasifikasi Negara & Zona Waktu (misal: Singapore GMT+8, Germany GMT+1, USA GMT-5).
 * - Klasifikasi Skala Perusahaan:
 *     * 'startup' (Baru Mulai / Startup: < 15 karyawan)
 *     * 'mid_market' (Menengah: 15–200 karyawan)
 *     * 'enterprise' (Besar: > 200 karyawan)
 * - Khusus skala Baru Mulai & Menengah: 1x pencarian tambahan Google
 *     (site:linkedin.com/in/ OR site:instagram.com "Nama Brand" Founder OR CEO OR Marketing)
 * - AI Lead Scoring (1-100) + 1 kalimat alasan kecocokan pasar Indonesia.
 * - Skor < 50 (atau < min_fit_score) otomatis ditandai 'skipped' (Tidak Cocok / Skip).
 */
export async function runEnrichAgent(batchSize = 3): Promise<{
  success: boolean;
  enrichedCount: number;
  skippedLowScoreCount: number;
  message: string;
  results: any[];
}> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil brand yang berstatus 'discovered'
  let targetBrands: any[] = [];
  let minFitScore = 50;

  if (isServerSupabaseConfigured()) {
    const { data: settings } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
    if (settings?.min_fit_score) {
      // Gunakan nilai minimum antara 50 (aturan blueprint) atau setting user
      minFitScore = Math.max(50, Number(settings.min_fit_score) || 50);
    }

    const { data: brands, error } = await supabaseServer
      .from('brands')
      .select('*')
      .eq('pipeline_status', 'discovered')
      .limit(batchSize);

    if (error) {
      throw new Error(`Gagal mengambil brand dari Supabase: ${error.message}`);
    }
    targetBrands = brands || [];
  }

  if (targetBrands.length === 0) {
    return {
      success: true,
      enrichedCount: 0,
      skippedLowScoreCount: 0,
      message: 'Tidak ada brand berstatus "discovered" yang menunggu investigasi Tahap A2/A3.',
      results: [],
    };
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
  const updatedResults: any[] = [];
  let skippedCount = 0;

  for (const brand of targetBrands) {
    if (isBrandExcluded(brand.domain) || isBrandExcluded(brand.company_name)) {
      console.log(`[Tahap A2 - Lyra] Brand dikecualikan (Blacklist): ${brand.company_name} (${brand.domain}) -> Set skipped`);
      if (isServerSupabaseConfigured()) {
        await supabaseServer.from('brands').update({ pipeline_status: 'skipped', ai_fit_reason: 'Dikecualikan oleh Adrien (Blacklisted)' }).eq('id', brand.id);
      }
      skippedCount++;
      continue;
    }

    console.log(`[Tahap A2-A3 - 02-enrichment] Investigasi Web & AI Scoring: ${brand.company_name} (${brand.domain})`);

    const baseUrl = brand.website_url || `https://${brand.domain}`;

    // 2. TAHAP A2: Baca halaman utama, About Us, profil sosmed, Founder, & High-Intent Signals
    const partnerQuery = `site:${brand.domain} (creator OR influencer OR affiliate OR partner)`;
    const fundingExpansionQuery = `"${brand.company_name}" (funding OR "Series A" OR "Series B" OR expansion OR "Southeast Asia" OR Indonesia)`;
    const founderDecisionMakerQuery = `site:linkedin.com/in/ OR site:instagram.com "${brand.company_name}" Founder OR CEO OR Marketing`;

    const [
      homepageMarkdown,
      aboutUsMarkdown,
      companySocialSnippets,
      founderDecisionMakerSnippets,
      partnerSnippets,
      fundingSnippets
    ] = await Promise.all([
      fetchWithJina(baseUrl, 3000),
      fetchWithJina(`${baseUrl.replace(/\/$/, '')}/about`, 2000),
      searchSerper(`"${brand.company_name}" OR "${brand.domain}" site:linkedin.com/company/ OR site:instagram.com`, 5),
      searchSerper(founderDecisionMakerQuery, 6),
      searchSerper(partnerQuery, 3),
      searchSerper(fundingExpansionQuery, 4),
    ]);

    // Deteksi cepat jika ada snippet partner program
    const hasPartnerSnippet = partnerSnippets && /(creator|influencer|affiliate|partner|ambassador|program)/i.test(partnerSnippets);

    // 4. Kirim seluruh teks ke Gemini API untuk analisis mendalam
    const prompt = `
Anda adalah Chief Partnership & Market Intelligence Analyst untuk kreator konten teknologi, bisnis, & produktivitas di Indonesia (audiens: 180.000+ Gen-Z, developer, pekerja remote, freelancer, tech enthusiast di Indonesia).

Tugas Anda (Tahap A2 & A3 Blueprint + Wave 1 High-Intent Detection):
Analisis seluruh data web perusahaan berikut dan isi profil lengkap untuk database Supabase.

=== DATA HASIL INVESTIGASI WEB ===
- Nama Brand Awal: ${brand.company_name}
- Domain Utama: ${brand.domain}
- Isi Halaman Utama (Jina Reader):
${homepageMarkdown || 'Tidak dapat diakses langsung'}
- Isi Halaman About Us (Jina Reader):
${aboutUsMarkdown || 'Tidak tersedia halaman /about terpisah'}
- Profil LinkedIn / Instagram Perusahaan:
${companySocialSnippets || 'N/A'}
- Hasil Pelacakan Founder / CEO / Marketing (${founderDecisionMakerQuery}):
${founderDecisionMakerSnippets || 'N/A'}
- Hasil Pengecekan Program Kreator/Afiliasi (${partnerQuery}):
${partnerSnippets || 'Tidak ditemukan halaman creator/partner'}
- Hasil Pengecekan Pendanaan & Ekspansi APAC (${fundingExpansionQuery}):
${fundingSnippets || 'Tidak ditemukan berita pendanaan terbaru'}

=== INSTRUKSI KLASIFIKASI WAJIB ===
0. Nama Resmi Brand/Perusahaan (company_name):
   - Tentukan nama resmi brand yang bersih (contoh: "Zapier", "DeskTime", "Gumloop", "Teamwork", "Webex", "Efficient App").
   - DILARANG KERAS menggunakan judul artikel listicle (contoh: "10 Best Tools", "I Tested 50+ Apps") atau slogan panjang!
1. Evaluasi Aksesibilitas Pasar Indonesia (is_indonesia_accessible):
   - Apakah produk atau aplikasi ini masuk akal dan dapat diakses/digunakan oleh masyarakat di Indonesia? (Contoh produk TIDAK aksesibel: asuransi kesehatan khusus warga negara AS, layanan pengiriman makanan lokal Jerman, bank lokal UK yang butuh SSN).
   - Set true jika SaaS, tools AI, platform produktivitas, dev tool, atau fintech global yang bisa diakses dari Indonesia. Set false jika khusus lokal negara barat saja.
2. Evaluasi Sinyal Niat Beli / Kemitraan (has_partner_program & buying_intent_signals):
   - Set has_partner_program = true jika terdeteksi halaman affiliate, creator program, ambassador, atau partner page.
   - Isi buying_intent_signals dengan daftar sinyal konkret, contoh: "Has /creators page", "Series A funding 2026", "Expanding to Southeast Asia", "Available in Indonesia".
3. Klasifikasi Negara & Zona Waktu:
   - Tentukan negara asal kantor pusat mereka (country, contoh: "Singapore", "Germany", "United States", "United Kingdom", "Australia", "Japan").
   - Tentukan zona waktu standar beserta offset GMT-nya (timezone, contoh: "Asia/Singapore (GMT+8)", "Europe/Berlin (GMT+1)", "America/New_York (GMT-5)", "Europe/London (GMT+0)", "Australia/Sydney (GMT+10)").
4. Klasifikasi Skala Perusahaan (company_scale & employee_count_est):
   - "startup" (<15 karyawan), "mid_market" (15-200 karyawan), atau "enterprise" (>200 karyawan).
5. Pelacakan Founder / Decision Maker:
   - Ekstrak founder_name, founder_linkedin_url, founder_instagram_url, primary_pic_name, primary_pic_role.
6. Ringkasan Produk & Ide Konten:
   - Tulis product_summary (1-2 kalimat tajam observasi produk untuk personalisasi cold email).
   - Berikan 2 ide konsep konten konkret untuk audiens Indonesia (suggested_content_ideas).
7. AI Lead Scoring:
   - Berikan nilai kecocokan dasar 1-100 (ai_fit_score).
   - Jika is_indonesia_accessible === false, nilai WAJIB <= 30.
   - Berikan 1 kalimat alasan kecocokan (ai_fit_reason).
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
                company_name: { type: 'STRING' as any },
                country: { type: 'STRING' as any },
                timezone: { type: 'STRING' as any },
                company_scale: { type: 'STRING' as any, enum: ['startup', 'mid_market', 'enterprise'] },
                employee_count_est: { type: 'STRING' as any },
                niche_category: { type: 'STRING' as any },
                product_summary: { type: 'STRING' as any },
                has_partner_program: { type: 'BOOLEAN' as any },
                is_indonesia_accessible: { type: 'BOOLEAN' as any },
                buying_intent_signals: {
                  type: 'ARRAY' as any,
                  items: { type: 'STRING' as any },
                },
                ai_fit_score: { type: 'INTEGER' as any },
                ai_fit_reason: { type: 'STRING' as any },
                suggested_content_ideas: {
                  type: 'ARRAY' as any,
                  items: { type: 'STRING' as any },
                },
                primary_pic_name: { type: 'STRING' as any },
                primary_pic_role: { type: 'STRING' as any },
                company_instagram_url: { type: 'STRING' as any },
                company_linkedin_url: { type: 'STRING' as any },
                founder_name: { type: 'STRING' as any },
                founder_instagram_url: { type: 'STRING' as any },
                founder_linkedin_url: { type: 'STRING' as any },
              },
              required: [
                'country',
                'timezone',
                'company_scale',
                'product_summary',
                'is_indonesia_accessible',
                'has_partner_program',
                'buying_intent_signals',
                'ai_fit_score',
                'ai_fit_reason',
                'suggested_content_ideas',
              ],
            },
          },
        });
        responseText = response.text || '';
        if (responseText) break;
      } catch (err: any) {
        console.warn(`[Tahap A2-A3 - 02-enrichment] Model ${model} gagal untuk ${brand.company_name}: ${err.message}. Mencoba model cadangan...`);
      }
    }

    try {
      if (!responseText) throw new Error('Seluruh model Gemini gagal menganalisis brand.');
      const extracted = JSON.parse(responseText);
      const isIndoAccessible = extracted.is_indonesia_accessible !== false;
      const hasPartnerProg = Boolean(extracted.has_partner_program || hasPartnerSnippet);
      const buyingSignals: string[] = Array.isArray(extracted.buying_intent_signals) ? extracted.buying_intent_signals : [];
      if (hasPartnerProg && !buyingSignals.some(s => /partner|creator|affiliate/i.test(s))) {
        buyingSignals.unshift('Has creator / partner program');
      }

      let rawScore = Math.max(1, Math.min(100, Number(extracted.ai_fit_score) || 65));

      // WAVE 1 LOGIC:
      // 1. Cek apakah website ini ternyata hanyalah blog pribadi/artikel/agregator
      const isBlogOrArticle =
        /personal blog|medium\.com|blogspot|wordpress|just an article|roundup of tools|affiliate directory/i.test(
          extracted.product_summary || ''
        ) ||
        /medium\.com|substack\.com/i.test(brand.domain);

      // 2. Jika produk TIDAK aksesibel di Indonesia atau sekadar artikel blog -> otomatis fit_score <= 30 & status skipped
      let finalScore = rawScore;
      let fitReason = extracted.ai_fit_reason || 'Produk relevan untuk pasar digital Indonesia.';

      if (isBlogOrArticle) {
        finalScore = 20;
        fitReason = 'Domain ini berupa artikel blog / agregator konten, bukan entitas SaaS atau brand asli.';
      } else if (!isIndoAccessible) {
        finalScore = Math.min(30, rawScore);
        fitReason = 'Produk tidak dapat diakses atau tidak relevan bagi audiens Indonesia (Khusus pasar lokal barat).';
      } else {
        // 3. Bonus +20 poin (maks 100) jika ada partner program atau sinyal funding/ekspansi APAC
        const hasHighIntentBonus = hasPartnerProg || buyingSignals.some(s => /funding|series|expansion|southeast asia|indonesia|apac/i.test(s));
        if (hasHighIntentBonus) {
          finalScore = Math.min(100, finalScore + 20);
          console.log(`[Tahap A2 - High Intent Bonus +20] Brand ${brand.company_name} mendapat bonus High-Intent! Skor: ${finalScore}`);
        }
      }

      // PENGAMAN TEKNIS: AI Lead Scoring Filter (Skor < 50 atau < minFitScore otomatis Tidak Cocok / Skip)
      const isLowFit = !isIndoAccessible || isBlogOrArticle || finalScore < 50 || finalScore < minFitScore;
      const nextStatus = isLowFit ? 'skipped' : 'enriched';

      if (isLowFit) {
        skippedCount++;
        console.log(
          `[Tahap A2-A3 - AI Lead Scoring] Brand ${brand.company_name} diberi skor ${finalScore} (< ${minFitScore}) / Aksesibel=${isIndoAccessible} -> Otomatis ditandai TIDAK COCOK / SKIP.`
        );
      }

      const scale: 'startup' | 'mid_market' | 'enterprise' = extracted.company_scale || 'startup';
      const defaultEmpEst =
        scale === 'startup' ? '<15 karyawan' : scale === 'mid_market' ? '15-200 karyawan' : '>200 karyawan';

      // Ekstraksi nama brand resmi yang bersih
      const rawExtractedName = (extracted.company_name || '').trim();
      const cleanCompName =
        rawExtractedName &&
        rawExtractedName.length <= 40 &&
        !/^\d+\s+|best\b|top\b|tested\b/i.test(rawExtractedName)
          ? rawExtractedName
          : cleanBrandName(brand.company_name || '', brand.domain);

      const updates = {
        company_name: cleanCompName,
        country: extracted.country || brand.country || 'United States',
        timezone: extracted.timezone || 'UTC',
        company_scale: scale,
        employee_count_est: extracted.employee_count_est || defaultEmpEst,
        niche_category: extracted.niche_category || brand.niche_category || 'Productivity SaaS',
        product_summary: extracted.product_summary || brand.product_summary,
        ai_fit_score: finalScore,
        ai_fit_reason: fitReason,
        suggested_content_ideas: extracted.suggested_content_ideas || [],
        primary_pic_name: extracted.primary_pic_name || extracted.founder_name || brand.primary_pic_name,
        primary_pic_role:
          extracted.primary_pic_role ||
          (scale === 'startup' ? 'Founder & CEO' : 'Head of Growth & Partnerships'),
        company_instagram_url: extracted.company_instagram_url || brand.company_instagram_url,
        company_linkedin_url: extracted.company_linkedin_url || brand.company_linkedin_url,
        // Khusus Baru Mulai & Menengah (atau jika ditemukan), simpan profil Founder
        founder_name: extracted.founder_name || brand.founder_name,
        founder_instagram_url: extracted.founder_instagram_url || brand.founder_instagram_url,
        founder_linkedin_url: extracted.founder_linkedin_url || brand.founder_linkedin_url,
        pipeline_status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (isServerSupabaseConfigured()) {
        const { error: updateErr } = await supabaseServer.from('brands').update(updates).eq('id', brand.id);
        if (updateErr) {
          console.error(`[Tahap A2-A3 - 02-enrichment] Gagal update Supabase untuk ${brand.company_name}:`, updateErr.message);
        } else {
          console.log(`[Tahap A2-A3 - 02-enrichment] ✅ ${brand.company_name} berhasil di-enrich! Status: ${nextStatus}, Skor: ${finalScore}`);
        }
      }

      updatedResults.push({ id: brand.id, company_name: brand.company_name, ...updates });
    } catch (err: any) {
      console.error(`[Tahap A2-A3 - 02-enrichment] Gagal menganalisis ${brand.company_name}:`, err.message);
    }
  }

  return {
    success: true,
    enrichedCount: updatedResults.length,
    skippedLowScoreCount: skippedCount,
    message: `[Tahap A2 & A3 Selesai] Menganalisis ${updatedResults.length} brand (${
      updatedResults.length - skippedCount
    } lolos AI Lead Scoring, ${skippedCount} otomatis di-skip karena skor rendah).`,
    results: updatedResults,
  };
}
