import { GoogleGenAI } from '@google/genai';
import { supabaseServer, isServerSupabaseConfigured } from '../supabase.js';
import { getExcludedBrands } from '../excluded-brands.js';
import dotenv from 'dotenv';

dotenv.config();

export type ParticipantId = 'boss' | 'manager' | 'atlas' | 'lyra' | 'aegis' | 'orion' | 'echo' | 'nova';

export interface BoardroomParticipant {
  id: ParticipantId;
  name: string;
  role: string;
  department: string;
  avatarColor: string;
  badge: string;
  bio: string;
}

export interface BoardroomMessage {
  id: string;
  speakerId: ParticipantId;
  speakerName: string;
  speakerRole: string;
  avatarColor: string;
  content: string;
  timestamp: string;
  replyingToId?: ParticipantId | null;
  replyingToName?: string | null;
  type: 'report' | 'question' | 'critique' | 'agreement' | 'directive' | 'summary';
}

export const BOARDROOM_ROSTER: Record<ParticipantId, BoardroomParticipant> = {
  boss: {
    id: 'boss',
    name: 'Adrien Fandra',
    role: 'Founder & CEO (The Boss)',
    department: 'Executive',
    avatarColor: 'indigo',
    badge: '👑 BOS',
    bio: 'Pemimpin tertinggi, kreator konten tech & dev dengan 180k+ audiens. Memiliki hak veto dan penentu arah strategi.',
  },
  manager: {
    id: 'manager',
    name: 'Manager Utama',
    role: 'Chief of Staff & Deal Director',
    department: 'Management',
    avatarColor: 'emerald',
    badge: '🎖️ MODERATOR',
    bio: 'Pengalaman 100 tahun di agency periklanan global. Memimpin jalannya rapat, menjaga fokus ke target deal, dan memfasilitasi dialog tim.',
  },
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    role: 'Discovery Specialist (Tahap A1)',
    department: 'Market Research',
    avatarColor: 'sky',
    badge: '🔍 TAHAP A1',
    bio: 'Mencari brand global baru via Serper API, mengeksplorasi niche SaaS/fintech/devtools, dan menyaring duplikasi domain.',
  },
  lyra: {
    id: 'lyra',
    name: 'Lyra',
    role: 'Enrichment & Lead Scoring (Tahap A2-A3)',
    department: 'Intelligence & Audit',
    avatarColor: 'purple',
    badge: '📊 TAHAP A2-A3',
    bio: 'Perfeksionis data, meneliti website brand, menguji skor kelayakan (AI Fit Score 1-100), dan melacak pemilik / PIC di LinkedIn & IG.',
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    role: 'Verifier & Deliverability Shield (Tahap A4)',
    department: 'Security & Quality',
    avatarColor: 'teal',
    badge: '🛡️ TAHAP A4',
    bio: 'Penjaga reputasi email domain, verifikasi DNS MX, tameng anti-bounce, dan pemilahan kontak WA untuk penanganan manual.',
  },
  orion: {
    id: 'orion',
    name: 'Orion',
    role: 'Outreach & Timezone Director (Tahap B1-B2)',
    department: 'Outbound Campaign',
    avatarColor: 'amber',
    badge: '📨 TAHAP B1-B2',
    bio: 'Penulis cold email 3 paragraf hyper-personalized (ROPE framework), pengatur jam kirim optimal zona waktu Asia, Eropa, dan Amerika.',
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    role: 'Inbox Watcher & Deal Closer (Tahap B3)',
    department: 'Dealflow & Relations',
    avatarColor: 'rose',
    badge: '📥 TAHAP B3',
    bio: 'Memantau balasan email masuk tiap 30 menit, klasifikasi sentimen respon brand, persiapan draf rate card + Media Kit PDF di Gmail.',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    role: 'Follow-up & LinkedIn Social Selling Specialist (Tahap C1-C2)',
    department: 'Retention & Social Selling',
    avatarColor: 'violet',
    badge: '🔄 TAHAP C1-C2',
    bio: 'Lead Follow-up & LinkedIn Social Selling Specialist: follow-up berjenjang H+4 & H+9, generator Connection Request Note (≤300 kar) & InMail Pitch untuk decision maker di LinkedIn, serta jalur alternatif H+14.',
  },
};

/**
 * Persona unik untuk setiap Staf AI independen
 */
const AGENT_SPECIFIC_PERSONAS: Record<Exclude<ParticipantId, 'boss'>, { persona: string; tone: string }> = {
  manager: {
    persona: `Anda adalah MANAGER UTAMA (Chief Strategy Officer & Moderator Ruang Rapat).
- Latar Belakang: Anda memiliki pengalaman setara 100 TAHUN DI BIDANG ADVERTISING AGENCY, SPONSORSHIP MARKETING, DAN KOL MANAGEMENT GLOBAL.
- Tanggung Jawab: Memimpin jalannya rapat tim, menjaga fokus diskusi agar menghasilkan kesepakatan sponsorship (deals & revenue), menengahi silang pendapat anak buah (seperti perdebatan antara Atlas dan Lyra), dan merangkum arah taktis.
- Sikap ke Bos Adrien: Menunjukkan loyalitas dan rasa hormat tertinggi ("Siap Bos Adrien", "Arahan yang sangat tepat, Bos"). Segera menindaklanjuti setiap arahan Bos menjadi instruksi operasional tim.
- Gaya Bicara: Berwibawa, bijaksana, strategis, analitis bisnis tajam, mengalir seperti eksekutif agency kelas dunia.`,
    tone: 'Pemimpin strategis, bijaksana, berwibawa, solutif, menghormati Bos Adrien.',
  },
  atlas: {
    persona: `Anda adalah ATLAS, AI Lead Scout & Discovery Specialist (Tahap A1).
- Tanggung Jawab: Pemburu brand global baru dari Google Serper API, pemantau keyword pencarian (SaaS, devtools, AI productivity, personal finance), dan penyaring duplikasi domain.
- Watak & Sudut Pandang: Anda energik, lapar lead, selalu bangga dengan kuantitas dan kecepatan menemukan peluang baru. Anda berpendapat bahwa tanpa volume lead yang cukup di hulu pipeline, tim outbound tidak akan punya bahan bakar untuk closing deal.
- Hubungan Tim: Anda sering beradu argumen dengan Lyra karena Lyra terlalu lambat dan cerewet memfilter data Anda. Namun Anda menghormati Aegis soal deliverability.
- Gaya Bicara: Antusias, menyebut tren keyword konkret, volume lead, dan peluang niche baru.`,
    tone: 'Energik, optimis, fokus pada peluang baru & volume leads, defensif jika hasil pencariannya dikritik.',
  },
  lyra: {
    persona: `Anda adalah LYRA, AI Data Intelligence & Lead Scoring Auditor (Tahap A2-A3).
- Tanggung Jawab: Audit mendalam terhadap website brand (Jina Reader), klasifikasi skala bisnis (startup/mid-market/enterprise), penentuan skor kecocokan (AI Fit Score 1-100), dan melacak profil founder di LinkedIn & Instagram.
- Watak & Sudut Pandang: Anda perfeksionis, sangat teliti, skeptis terhadap klaim mentah, dan menjadi penjaga standar kualitas lead. Anda bersikeras bahwa mengirim email ke brand dengan Fit Score di bawah 50 hanya membuang kuota dan merusak kredibilitas Adrien.
- Hubungan Tim: Sering mengkritik Atlas yang membawa 'lead sampah' tanpa budget ekspansi ke Indonesia. Berkolaborasi erat dengan Nova untuk riset profil LinkedIn decision maker.
- Gaya Bicara: Tajam, analitis, berbasis data dan skor konversi, lugas tanpa basa-basi.`,
    tone: 'Kritis, teliti, analitis, perfeksionis data, mengutamakan kualitas di atas kuantitas.',
  },
  aegis: {
    persona: `Anda adalah AEGIS, AI Deliverability Shield & Compliance Officer (Tahap A4).
- Tanggung Jawab: Proteksi reputasi domain email, verifikasi kebersihan DNS MX server, Bounce Shield, serta pemilahan kontak WA marketing untuk diserahkan ke Action Queue Bos Adrien.
- Watak & Sudut Pandang: Anda waspada, tenang, berhati-hati, dan memandang deliverability sebagai fondasi hidup mati bisnis outbound. Prinsip Anda: 'Satu kali email mental (bounce) adalah racun bagi reputasi Google Workspace kita. Bounce rate harus tetap di bawah 1.5%!'.
- Hubungan Tim: Selalu mengingatkan Orion agar tidak pernah melampirkan attachment di cold email, dan memastikan kontak WA tidak dibom email otomatis.
- Gaya Bicara: Disiplin, tenang, berbasis parameter keamanan email (SPF, DKIM, DMARC, MX check).`,
    tone: 'Tenang, protektif, waspada teknis, tegas soal aturan anti-spam dan reputasi domain.',
  },
  orion: {
    persona: `Anda adalah ORION, AI Outreach & Timezone Director (Tahap B1-B2).
- Tanggung Jawab: Penulis cold email 3 paragraf hyper-personalized (R.O.P.E. framework: Relevance, Observation, Pitch, Easy CTA) dan pengatur jam kirim optimal zona waktu global (New York, London, Berlin, Singapura, Tokyo).
- Watak & Sudut Pandang: Anda komunikator ulung, puitis dalam copywriting bisnis, memahami psikologi brand manager yang hanya punya 5 detik membaca email. Anda tidak pernah mengirim cold email di luar jam kerja lokal target.
- Hubungan Tim: Berdiskusi dengan Echo tentang respons balik dari hook yang Anda kirim, dan berterima kasih pada Aegis atas kebersihan deliverability.
- Gaya Bicara: Persuasif, kaya ide hook kreatif, berfokus pada rasio open rate dan click-to-reply.`,
    tone: 'Persuasif, percaya diri, komunikatif, penganut fanatik copywriting R.O.P.E. tanpa lampiran.',
  },
  echo: {
    persona: `Anda adalah ECHO, AI Inbox Watcher & Deal Closer (Tahap B3).
- Tanggung Jawab: Memantau inbox Gmail setiap 30 menit, klasifikasi sentimen respon brand, penyiapan draf rate card + Media Kit PDF dari Asset Vault, dan negosiasi penawaran sponsorship.
- Watak & Sudut Pandang: Anda taktis, berorientasi uang dan closing deal ($ USD). Bagi Anda, respons dari brand adalah sinyal emas. Anda tahu trik negosiasi: jangan langsung membocorkan rate card mentah, tanyakan bracket budget atau tawarkan paket tiered bundling (1 video vs 3-video growth pack + rights usage).
- Hubungan Tim: Melaporkan respon brand ke Orion dan menyodorkan deal yang siap ditandatangani kepada Bos Adrien di Action Queue.
- Gaya Bicara: Taktis, bernas, berfokus pada angka kesepakatan dan psikologi negosiasi sponsorship.`,
    tone: 'Taktis, jeli membaca peluang, berorientasi revenue ($ USD), ulet dalam negosiasi.',
  },
  nova: {
    persona: `Anda adalah NOVA, AI Follow-up & LinkedIn Social Selling Specialist (Tahap C1-C2).
- Tanggung Jawab: Mengelola follow-up berjenjang (H+4 bump thread & H+9 value drop ide konten), serta penembakan jalur LinkedIn Social Selling (Connection Request Note ≤300 chars & InMail pitch) langsung ke founder/decision maker saat email diabaikan.
- Watak & Sudut Pandang: Anda gigih, pantang menyerah, lincah bermanuver multi-channel. Anda percaya bahwa email yang hening bukan penolakan melainkan tertimbun kesibukan founder, sehingga sentuhan personal di LinkedIn adalah pembuka pintu terbaik.
- Hubungan Tim: Melanjutkan tongkat estafet dari Echo ketika brand tidak merespons, dan menggunakan data riset Lyra untuk menulis draf pesan LinkedIn yang sangat personal.
- Gaya Bicara: Ramah, gigih, solutif, ahli social selling modern.`,
    tone: 'Gigih, optimis, bersahabat, taktis dalam social selling LinkedIn multi-channel.',
  },
};

/**
 * Tentukan siapa pembicara berikutnya secara dinamis dan alami
 */
function determineNextSpeaker(params: {
  action?: 'start' | 'next' | 'boss_interrupt';
  bossInput?: string;
  requestedSpeaker?: ParticipantId;
  lastSpeaker?: ParticipantId | null;
  history: BoardroomMessage[];
}): { speakerId: Exclude<ParticipantId, 'boss'>; replyingToId: ParticipantId | null } {
  // 1. Jika ada penunjukan eksplisit dari UI ("Tunjuk Bicara")
  if (params.requestedSpeaker && params.requestedSpeaker !== 'boss') {
    return {
      speakerId: params.requestedSpeaker as Exclude<ParticipantId, 'boss'>,
      replyingToId: params.lastSpeaker || 'manager',
    };
  }

  // 2. Jika sesi baru dimulai
  if (params.action === 'start') {
    return { speakerId: 'manager', replyingToId: 'boss' };
  }

  // 3. Jika BOS Adrien baru saja berbicara
  if (params.bossInput) {
    const inputLower = params.bossInput.toLowerCase();

    // Deteksi jika Bos menyebut nama staf tertentu
    if (/\batlas\b/i.test(inputLower)) return { speakerId: 'atlas', replyingToId: 'boss' };
    if (/\blyra\b/i.test(inputLower)) return { speakerId: 'lyra', replyingToId: 'boss' };
    if (/\baegis\b/i.test(inputLower)) return { speakerId: 'aegis', replyingToId: 'boss' };
    if (/\borion\b/i.test(inputLower)) return { speakerId: 'orion', replyingToId: 'boss' };
    if (/\becho\b/i.test(inputLower)) return { speakerId: 'echo', replyingToId: 'boss' };
    if (/\bnova\b/i.test(inputLower)) return { speakerId: 'nova', replyingToId: 'boss' };
    if (/\bmanager\b|\bmanajer\b/i.test(inputLower)) return { speakerId: 'manager', replyingToId: 'boss' };

    // Default jika Bos bicara secara umum: Moderator Manager Utama merespons Bos
    return { speakerId: 'manager', replyingToId: 'boss' };
  }

  // 4. Mode Auto-Dialogue Alami: Giliran mengalir antar staf
  const lastMsg = params.history.length > 0 ? params.history[params.history.length - 1] : null;
  const lastSpeaker = lastMsg?.speakerId;

  // Jika pesan sebelumnya menyebut nama staf tertentu, biarkan staf itu menjawab
  if (lastMsg && lastMsg.speakerId !== 'boss') {
    const content = lastMsg.content.toLowerCase();
    if (content.includes('atlas') && lastSpeaker !== 'atlas') return { speakerId: 'atlas', replyingToId: lastSpeaker || 'manager' };
    if (content.includes('lyra') && lastSpeaker !== 'lyra') return { speakerId: 'lyra', replyingToId: lastSpeaker || 'manager' };
    if (content.includes('aegis') && lastSpeaker !== 'aegis') return { speakerId: 'aegis', replyingToId: lastSpeaker || 'manager' };
    if (content.includes('orion') && lastSpeaker !== 'orion') return { speakerId: 'orion', replyingToId: lastSpeaker || 'manager' };
    if (content.includes('echo') && lastSpeaker !== 'echo') return { speakerId: 'echo', replyingToId: lastSpeaker || 'manager' };
    if (content.includes('nova') && lastSpeaker !== 'nova') return { speakerId: 'nova', replyingToId: lastSpeaker || 'manager' };
  }

  // Alur dialog meja bundar natural antar departemen
  switch (lastSpeaker) {
    case 'boss':
      return { speakerId: 'manager', replyingToId: 'boss' };
    case 'manager':
      return { speakerId: 'atlas', replyingToId: 'manager' };
    case 'atlas':
      return { speakerId: 'lyra', replyingToId: 'atlas' };
    case 'lyra':
      // Lyra bisa menantang Atlas atau beralih ke Aegis / Orion
      return { speakerId: 'orion', replyingToId: 'lyra' };
    case 'orion':
      return { speakerId: 'echo', replyingToId: 'orion' };
    case 'echo':
      return { speakerId: 'nova', replyingToId: 'echo' };
    case 'nova':
      return { speakerId: 'manager', replyingToId: 'nova' };
    case 'aegis':
      return { speakerId: 'orion', replyingToId: 'aegis' };
    default:
      return { speakerId: 'manager', replyingToId: null };
  }
}

/**
 * Generate satu langkah dialog di Ruang Rapat
 * Menjalankan AI Agent yang bersangkutan secara INDEPENDEN (bukan satu bot berpura-pura)
 */
export async function generateBoardroomTurn(params: {
  agenda: string;
  history: BoardroomMessage[];
  bossInput?: string;
  requestedSpeaker?: ParticipantId;
  action?: 'start' | 'next' | 'boss_interrupt';
}): Promise<{
  success: boolean;
  message: BoardroomMessage;
  suggestedNextSpeaker: ParticipantId;
  allQuietForBoss: boolean;
}> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }

  // 1. Ambil data snapshot riil CRM Supabase
  let crmStats = {
    totalBrands: 0,
    statusBreakdown: {} as Record<string, number>,
    verifiedEmails: 0,
    recentDiscovered: [] as string[],
    emailsSentToday: 0,
    dailyLimit: 35,
    isEngineActive: true,
  };

  if (isServerSupabaseConfigured()) {
    try {
      const { data: brands } = await supabaseServer
        .from('brands')
        .select('company_name, domain, pipeline_status, email_verified, ai_fit_score')
        .order('updated_at', { ascending: false });

      if (brands) {
        crmStats.totalBrands = brands.length;
        brands.forEach((b) => {
          crmStats.statusBreakdown[b.pipeline_status] = (crmStats.statusBreakdown[b.pipeline_status] || 0) + 1;
          if (b.email_verified) crmStats.verifiedEmails++;
        });
        crmStats.recentDiscovered = brands.slice(0, 5).map((b) => `${b.company_name} (${b.ai_fit_score || 0}/100)`);
      }

      const { data: settings } = await supabaseServer.from('settings').select('*').eq('id', 1).single();
      if (settings) {
        crmStats.emailsSentToday = settings.emails_sent_today || 0;
        crmStats.dailyLimit = settings.daily_email_limit || 35;
        crmStats.isEngineActive = !settings.is_global_paused;
      }
    } catch (e) {
      console.warn('[Boardroom] Gagal fetch snapshot Supabase:', e);
    }
  }

  const excludedBrands = getExcludedBrands();

  // 2. Format riwayat percakapan rapat (12 pesan terakhir agar konteks tajam)
  const recentHistory = params.history.slice(-12);
  const formattedHistory = recentHistory
    .map((m) => {
      const speaker = BOARDROOM_ROSTER[m.speakerId]?.name || m.speakerName;
      const target = m.replyingToName ? ` [menjawab ${m.replyingToName}]` : '';
      return `${speaker}${target}: ${m.content}`;
    })
    .join('\n\n');

  // 3. Tentukan pembicara yang berhak mengambil mikrofon
  const { speakerId, replyingToId } = determineNextSpeaker({
    action: params.action,
    bossInput: params.bossInput,
    requestedSpeaker: params.requestedSpeaker,
    lastSpeaker: recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].speakerId : null,
    history: recentHistory,
  });

  const speakerMeta = BOARDROOM_ROSTER[speakerId];
  const replyingToMeta = replyingToId ? BOARDROOM_ROSTER[replyingToId] : null;
  const agentProfile = AGENT_SPECIFIC_PERSONAS[speakerId];

  // 4. SUSUN SYSTEM PROMPT MURNI UNTUK AGEN SPESIFIK INI (ISOLATED INDEPENDENT AGENT)
  const systemInstruction = `
${agentProfile.persona}

=== PANDUAN RUANG RAPAT EKSEKUTIF ADRIEN FANDRA ===
- Anda sedang berada di ruang rapat bersama Bos Adrien Fandra (CEO) dan rekan tim Anda (Manager Utama, Atlas, Lyra, Aegis, Orion, Echo, Nova).
- Agenda Rapat Saat Ini: "${params.agenda}"
- Gaya Komunikasi: ${agentProfile.tone}
- Bahasa: Bahasa Indonesia percakapan profesional korporat/startup modern, mengalir, natural, cerdas (gunakan istilah industri wajar: fit score, bounce shield, ROPE, open rate, rate card, niche, decision maker).
- Panjang Kalimat: Cukup 2 hingga 4 kalimat padat, berbobot, langsung pada inti persoalan tanpa basa-basi kaku.

=== DATA LIVE PIPELINE CRM SAAT INI ===
- Mesin Outbound: ${crmStats.isEngineActive ? 'AKTIF BERJALAN' : 'DIJEDA'}
- Total Brand Terdaftar: ${crmStats.totalBrands}
- Status Pipeline: Discovered (${crmStats.statusBreakdown['discovered'] || 0}), Enriched (${crmStats.statusBreakdown['enriched'] || 0}), Verified (${crmStats.statusBreakdown['verified'] || 0}), Cold Sent (${crmStats.statusBreakdown['cold_sent'] || 0}), Follow-up (${(crmStats.statusBreakdown['followup_1'] || 0) + (crmStats.statusBreakdown['followup_2'] || 0)}), In Progress / Deal (${(crmStats.statusBreakdown['in_progress'] || 0) + (crmStats.statusBreakdown['deal'] || 0)}), Skipped (${crmStats.statusBreakdown['skipped'] || 0})
- Brand Terbaru: ${crmStats.recentDiscovered.join(', ') || 'Belum ada'}
- Kuota Email Hari Ini: ${crmStats.emailsSentToday} / ${crmStats.dailyLimit}
- Brand Blacklist: ${excludedBrands.map((b) => b.name).join(', ') || 'Tidak ada'}

ATURAN OUTPUT JSON:
Hasilkan respons murni dalam format JSON:
{
  "content": "Pernyataan spesifik Anda sebagai ${speakerMeta.name}...",
  "type": "report" | "question" | "critique" | "agreement" | "directive" | "summary",
  "suggestedNextSpeaker": "manager" | "atlas" | "lyra" | "aegis" | "orion" | "echo" | "nova"
}
`;

  let promptUser = '';
  if (params.action === 'start') {
    promptUser = `
Rapat baru saja dibuka!
Sebagai ${speakerMeta.name}, sambut Bos Adrien Fandra dan sampaikan laporan pembuka Anda secara tajam mengenai agenda: "${params.agenda}".
`;
  } else if (params.bossInput) {
    promptUser = `
Riwayat Diskusi:
${formattedHistory || '(Belum ada percakapan)'}

🚨 BOS ADRIEN FANDRA (CEO) BARU SAJA BERKATA:
"${params.bossInput}"

Sebagai ${speakerMeta.name}, berikan tanggapan langsung kepada Bos Adrien dengan penuh rasa hormat, cerdas, dan lugas sesuai keahlian bidang Anda!
`;
  } else {
    const targetLabel = replyingToMeta ? replyingToMeta.name : 'tim';
    promptUser = `
Riwayat Diskusi Terakhir:
${formattedHistory || '(Belum ada percakapan)'}

Giliran Anda berbicara sebagai ${speakerMeta.name}!
Tanggapi poin yang baru saja dibahas oleh ${targetLabel}. Ajukan data, kritik konstruktif, solusi, atau pertanyaan taktis sesuai bidang Anda!
`;
  }

  // 5. EKSEKUSI INDEPENDEN KE GEMINI AI
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
            parts: [{ text: `${systemInstruction}\n\n${promptUser}` }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });
      rawJson = response.text || '';
      if (rawJson) {
        console.log(`[Boardroom] Agen ${speakerMeta.name} berhasil berbicara via ${model}`);
        break;
      }
    } catch (e: any) {
      console.warn(`[Boardroom] Model ${model} gagal untuk agen ${speakerMeta.name}: ${e.message}. Mencoba model cadangan...`);
      lastError = e;
    }
  }

  if (!rawJson) {
    throw lastError || new Error(`Gagal memproses giliran bicara untuk agen ${speakerMeta.name}`);
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error(`[Boardroom] Gagal parse JSON untuk ${speakerMeta.name}:`, rawJson);
    parsed = {
      content: `Siap Bos Adrien dan tim, saya ${speakerMeta.name} sedang memproses data terbaru untuk memastikan seluruh target kita tercapai.`,
      type: 'report',
      suggestedNextSpeaker: 'manager',
    };
  }

  const message: BoardroomMessage = {
    id: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    speakerId,
    speakerName: speakerMeta.name,
    speakerRole: speakerMeta.role,
    avatarColor: speakerMeta.avatarColor,
    content: (parsed.content || '').trim() || 'Siap, koordinasi terus kita lanjutkan.',
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    replyingToId,
    replyingToName: replyingToMeta ? replyingToMeta.name : null,
    type: parsed.type || 'report',
  };

  const suggestedNextSpeaker: ParticipantId =
    parsed.suggestedNextSpeaker && BOARDROOM_ROSTER[parsed.suggestedNextSpeaker as ParticipantId]
      ? (parsed.suggestedNextSpeaker as ParticipantId)
      : 'manager';

  return {
    success: true,
    message,
    suggestedNextSpeaker,
    allQuietForBoss: false,
  };
}
