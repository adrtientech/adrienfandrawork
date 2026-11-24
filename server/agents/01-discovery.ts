import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { isBrandExcluded } from '../excluded-brands.js';
import dotenv from 'dotenv';

dotenv.config();

const EXCLUDED_DOMAINS = new Set([
  'google.com',
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'wikipedia.org',
  'reddit.com',
  'github.com',
  'medium.com',
  'crunchbase.com',
  'g2.com',
  'capterra.com',
  'trustpilot.com',
  'producthunt.com',
  'forbes.com',
  'bloomberg.com',
  'techcrunch.com',
  'apple.com',
  'microsoft.com',
  'amazon.com',
  'ycombinator.com',
  'substack.com',
  'tiktok.com',
  'pinterest.com',
  'quora.com',
  'coursera.org',
  'udemy.com',
  'wordpress.com',
  'blogspot.com',
  'ghost.io',
  'dev.to',
  'hashnode.dev',
  'notion.site',
  'wixsite.com',
  'weebly.com',
  'hubspotpage.com',
]);

/**
 * Membersihkan nama brand dari judul hasil pencarian Google agar tidak menjadi judul artikel / listicle
 */
export function cleanBrandName(title: string, domain: string): string {
  const domainParts = domain.split('.');
  const baseDomain = domainParts[0] || domain;
  const capitalizedBase = baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1);

  if (!title) return capitalizedBase;

  // Pola artikel/listicle/review yang BUKAN nama brand murni
  const isArticleOrListicle = /^\d+\s+|best\b|top\b|how\s+to|tested\b|vs\b|review\b|guide\b|survived\b|tools\b|apps\b|software\b/i.test(title);

  // Jika judul dipisahkan pemisah (contoh: "Zapier: Workflow Automation" atau "10 Best Tools | DeskTime")
  const segments = title.split(/[-–|:—•]/).map((s) => s.trim()).filter(Boolean);

  // Cari segmen yang menyebutkan nama brand dasar
  for (const seg of segments) {
    if (
      seg.toLowerCase().includes(baseDomain.toLowerCase()) &&
      seg.length <= 30 &&
      !/^\d+\s+|best\b|top\b/i.test(seg)
    ) {
      return seg;
    }
  }

  // Jika judul adalah artikel/listicle dan tidak ada segmen nama brand yang cocok, gunakan nama domain yang rapi
  if (isArticleOrListicle) {
    return capitalizedBase;
  }

  // Jika segmen pertama pendek dan bersih (<= 35 karakter) serta bukan judul listicle
  if (segments[0] && segments[0].length <= 35 && !/^\d+\s+|best\b|top\b|tested\b/i.test(segments[0])) {
    return segments[0];
  }

  return capitalizedBase;
}

/**
 * Mengekstrak domain utama (root domain, contoh: wise.com) dari URL hasil pencarian
 */
export function extractRootDomain(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    const host = parsed.hostname
      .toLowerCase()
      .replace(/^(www|app|blog|help|support|docs|careers|get|try|go)\./, '');

    if (
      host.includes('google.') ||
      host.includes('.gov') ||
      host.includes('.edu') ||
      host.length < 4
    ) {
      return null;
    }

    // Blokir domain blacklist dan semua subdomainnya (contoh: *.medium.com, *.substack.com)
    for (const exc of EXCLUDED_DOMAINS) {
      if (host === exc || host.endsWith(`.${exc}`)) {
        return null;
      }
    }

    return host;
  } catch {
    return null;
  }
}

/**
 * TAHAP A1: Penemuan Brand Pintar & Deduplikasi Otomatis (01-discovery.ts)
 * - Memanggil Serper API (Google Search) menggunakan kata kunci terarah (fintech, edtech, productivity, SaaS ekspansi SEA).
 * - Filter Anti-Duplikat Instan: Mengecek domain terhadap UNIQUE KEY di tabel brands Supabase dalam hitungan milidetik.
 * - Menyimpan domain yang benar-benar baru ke Supabase dengan status awal 'discovered'.
 */
export async function runDiscoverAgent(limitPerRun = 5): Promise<{
  success: boolean;
  discoveredCount: number;
  skippedDuplicateCount: number;
  message: string;
  brands: any[];
}> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    throw new Error('SERPER_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil keyword & negara target dari tabel settings
  let keywords: string[] = [
    'personal finance app global',
    'AI productivity tool SaaS',
    'fintech investing platform SEA',
    'edtech career platform international',
    'global remote work tools',
  ];
  let countries: string[] = [
    'United States',
    'Singapore',
    'United Kingdom',
    'Germany',
    'Australia',
    'Japan',
  ];

  if (isServerSupabaseConfigured()) {
    const { data: settings } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
    if (settings) {
      if (settings.discovery_keywords?.length > 0) keywords = settings.discovery_keywords;
      if (settings.target_countries?.length > 0) countries = settings.target_countries;
    }
  }

  // Pilih kata kunci & variasi pencarian terarah (ekspansi Asia Tenggara / produk SaaS & App aktif)
  const selectedKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  const selectedCountry = countries[Math.floor(Math.random() * countries.length)];

  // Query bersih tanpa operator boolean bertingkat agar kompatibel dengan Serper Free tier
  const searchQuery = `${selectedKeyword} software app`;

  console.log(`[Tahap A1 - 01-discovery] Mencari via Serper API: "${searchQuery}" (Target: ${selectedCountry})`);

  const startTime = Date.now();
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': serperKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: searchQuery,
      num: 20,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const organicResults = result.organic || [];
  const candidateDomains: { name: string; domain: string; url: string; snippet: string }[] = [];

  for (const item of organicResults) {
    if (!item.link) continue;
    const domain = extractRootDomain(item.link);
    if (!domain) continue;

    const cleanName = cleanBrandName(item.title || '', domain);

    if (!candidateDomains.some((c) => c.domain === domain)) {
      candidateDomains.push({
        name: cleanName || domain,
        domain,
        url: `https://${domain}`,
        snippet: item.snippet || '',
      });
    }
  }

  if (candidateDomains.length === 0) {
    return {
      success: true,
      discoveredCount: 0,
      skippedDuplicateCount: 0,
      message: 'Tidak ada domain kandidat baru yang ditemukan pada pencarian ini.',
      brands: [],
    };
  }

  // 2. FILTER ANTI-DUPLIKAT INSTAN (Single Batch Query ke UNIQUE KEY `domain` di Supabase)
  const dedupStart = Date.now();
  const allCandidateDomainStrings = candidateDomains.map((c) => c.domain);
  const existingDomainSet = new Set<string>();

  if (isServerSupabaseConfigured()) {
    const { data: existingRows } = await supabaseServer
      .from('brands')
      .select('domain')
      .in('domain', allCandidateDomainStrings);

    if (existingRows) {
      for (const row of existingRows) {
        if (row.domain) existingDomainSet.add(row.domain.toLowerCase());
      }
    }

    // WAVE 1: Cegah penemuan ulang domain yang ditandai do_not_contact = true
    const { data: blacklistRows } = await supabaseServer
      .from('brands')
      .select('domain')
      .eq('do_not_contact', true);

    if (blacklistRows) {
      for (const row of blacklistRows) {
        if (row.domain) existingDomainSet.add(row.domain.toLowerCase());
      }
    }
  }
  const dedupMs = Date.now() - dedupStart;

  let skippedDuplicates = 0;
  const newBrandsToInsert: any[] = [];

  for (const candidate of candidateDomains) {
    if (isBrandExcluded(candidate.domain) || isBrandExcluded(candidate.name)) {
      console.log(`[Tahap A1 - Blacklist Filter] Melewati brand yang dikecualikan oleh Adrien: ${candidate.name} (${candidate.domain})`);
      continue;
    }

    if (existingDomainSet.has(candidate.domain)) {
      skippedDuplicates++;
      console.log(`[Tahap A1 - Anti-Duplikat] Buang domain duplikat (${dedupMs}ms): ${candidate.domain}`);
      continue;
    }

    if (newBrandsToInsert.length >= limitPerRun) break;

    newBrandsToInsert.push({
      company_name: candidate.name,
      domain: candidate.domain,
      website_url: candidate.url,
      country: selectedCountry,
      timezone: 'UTC',
      company_scale: 'startup',
      niche_category: selectedKeyword.toLowerCase().includes('fintech') || selectedKeyword.toLowerCase().includes('finance')
        ? 'Fintech'
        : selectedKeyword.toLowerCase().includes('edtech')
        ? 'Edtech'
        : selectedKeyword.toLowerCase().includes('ai')
        ? 'AI Tools'
        : 'Productivity SaaS',
      product_summary: candidate.snippet || 'Ditemukan otomatis oleh Tahap A1 (01-discovery.ts). Menunggu investigasi web Tahap A2.',
      ai_fit_score: 70,
      outreach_channel: 'email_auto',
      pipeline_status: 'discovered',
      email_verified: false,
      email_history: [],
      suggested_content_ideas: [],
    });
  }

  // 3. PENCATATAN AWAL KE SUPABASE DENGAN STATUS 'discovered'
  if (newBrandsToInsert.length > 0 && isServerSupabaseConfigured()) {
    const { data: inserted, error: insertError } = await supabaseServer
      .from('brands')
      .upsert(newBrandsToInsert, { onConflict: 'domain', ignoreDuplicates: true })
      .select();

    if (insertError) {
      throw new Error(`Gagal menyimpan brand baru ke Supabase: ${insertError.message}`);
    }

    const totalElapsed = Date.now() - startTime;
    return {
      success: true,
      discoveredCount: inserted?.length || 0,
      skippedDuplicateCount: skippedDuplicates,
      message: `[Tahap A1 Selesai - ${totalElapsed}ms] Menemukan ${inserted?.length || 0} brand baru berstatus "discovered" (Membuang ${skippedDuplicates} duplikat dalam ${dedupMs}ms).`,
      brands: inserted || [],
    };
  }

  return {
    success: true,
    discoveredCount: newBrandsToInsert.length,
    skippedDuplicateCount: skippedDuplicates,
    message: `[Tahap A1] Menemukan ${newBrandsToInsert.length} brand baru (Membuang ${skippedDuplicates} duplikat).`,
    brands: newBrandsToInsert,
  };
}
