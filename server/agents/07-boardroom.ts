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
    role: 'Follow-up & Multichannel Strategist (Tahap C1-C2)',
    department: 'Retention & Recovery',
    avatarColor: 'violet',
    badge: '🔄 TAHAP C1-C2',
    bio: 'Follow-up berjenjang (H+4 & H+9 value drop), penembakan jalur darurat DM IG/LinkedIn ke founder saat email tidak direspons.',
  },
};

/**
 * Generate langkah percakapan di Ruang Rapat
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

  // 1. Ambil data snapshot riil CRM
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

  // 2. Format riwayat percakapan rapat
  const recentHistory = params.history.slice(-14);
  const formattedHistory = recentHistory
    .map((m) => {
      const speaker = BOARDROOM_ROSTER[m.speakerId]?.name || m.speakerName;
      const target = m.replyingToName ? ` [menanggapi ${m.replyingToName}]` : '';
      return `${speaker}${target}: ${m.content}`;
    })
    .join('\n\n');

  // 3. Tentukan giliran pembicara yang logis
  const lastSpeaker = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].speakerId : null;

  // System instruction
  const systemPrompt = `
Anda adalah mesin orkestrasi "Ruang Rapat Eksekutif Multi-Agen" (AI Boardroom War Room) untuk Adrien Fandra (Bos / CEO).
Rapat ini dihadiri oleh 8 tokoh utama:
1. Adrien Fandra (BOS / CEO) -> Pemimpin tertinggi, kreator tech 180k+ audiens. Setiap perintahnya adalah hukum tertinggi bagi tim.
2. Manager Utama -> Moderator rapat, pengalaman agency 100 tahun. Menjaga alur diskusi, memfasilitasi dialog antar-karyawan, tajam dalam strategi bisnis dan dealflow.
3. Atlas (A1 - Discovery) -> Pemburu brand global, lapor data Serper, volume lead baru, efektivitas keyword.
4. Lyra (A2-A3 - Enrichment & Scoring) -> Perfeksionis audit, lapor AI Fit Score, kelayakan brand ekspansi ke Indonesia, riset LinkedIn/IG decision makers. Sering debat dengan Atlas soal kualitas vs kuantitas lead.
5. Aegis (A4 - Verifier & Bounce Shield) -> Penjaga keamanan email, lapor kebersihan DNS MX, proteksi bounce rate, pisah nomor WA manual.
6. Orion (B1-B2 - Outreach & Timezone) -> Eksekutor cold email, lapor jam kirim zona waktu (Asia/Eropa/Amerika), copy pitching tanpa attachment, open rate.
7. Echo (B3 - Inbox Watcher & Closer) -> Negosiator respon brand, lapor balasan email masuk, draf rate card + Media Kit PDF di Gmail, penawaran paket sponsor.
8. Nova (C1-C2 - Follow-up & Retensi) -> Strategis follow-up berjenjang H+4 & H+9, drop ide konten, penembakan jalur darurat DM IG/LinkedIn ke founder jika email tidak dibalas.

=== DATA LIVE PIPELINE CRM SAAT RAPAT ===
- Status Mesin Engine: ${crmStats.isEngineActive ? 'AKTIF' : 'DIJEDA'}
- Total Brand di Pipeline: ${crmStats.totalBrands}
- Rincian Status: Discovered (${crmStats.statusBreakdown['discovered'] || 0}), Enriched (${crmStats.statusBreakdown['enriched'] || 0}), Verified (${crmStats.statusBreakdown['verified'] || 0}), Cold Sent (${crmStats.statusBreakdown['cold_sent'] || 0}), Follow-up (${(crmStats.statusBreakdown['followup_1'] || 0) + (crmStats.statusBreakdown['followup_2'] || 0)}), In Progress / Deal (${(crmStats.statusBreakdown['in_progress'] || 0) + (crmStats.statusBreakdown['deal'] || 0)}), Skipped (${crmStats.statusBreakdown['skipped'] || 0})
- Brand Terbaru: ${crmStats.recentDiscovered.join(', ') || 'Belum ada'}
- Kuota Email Hari Ini: ${crmStats.emailsSentToday} / ${crmStats.dailyLimit}
- Brand yang Dikecualikan (Blacklist): ${excludedBrands.map((b) => b.name).join(', ') || 'Tidak ada'}

=== ATURAN DINAMIKA DIALOG RAPAT ===
1. Bentuk percakapan adalah DIALOG GROUP CHAT AKTIF:
   - Karyawan saling menanggapi, mengkritisi dengan sopan, berdebat konstruktif, atau bertanya satu sama lain.
   - Contoh: Atlas melaporkan keyword SaaS, Lyra menanggapi bahwa skor rata-ratanya rendah, Orion menyambung bahwa email ke brand tersebut kurang direspon, lalu Echo memberikan data balasan terbaru.
2. Ketika BOS (Adrien Fandra) berbicara / menginstruksikan:
   - Seluruh karyawan langsung hening mendengarkan.
   - Pembicara berikutnya WAJIB menanggapi Bos Adrien dengan penuh hormat ("Siap Bos Adrien!", "Saran yang sangat tepat, Bos...", "Izin melaporkan terkait arahan Bos...").
3. Gaya bahasa:
   - Cerdas, realistis, natural bahasa Indonesia korporat/startup modern (campuran istilah tech/marketing yang wajar: *fit score*, *bounce rate*, *deliverability*, *rate card*, *anchor price*, *decision maker*, *niche*, *closed deal*).
   - Kalimat padat, berbobot (2 sampai 5 kalimat per pembicara), jangan bertele-tele dan hindari template kaku.
4. Output JSON WAJIB sesuai skema:
{
  "speakerId": "manager" | "atlas" | "lyra" | "aegis" | "orion" | "echo" | "nova",
  "replyingToId": "boss" | "manager" | "atlas" | "lyra" | "aegis" | "orion" | "echo" | "nova" | null,
  "type": "report" | "question" | "critique" | "agreement" | "directive" | "summary",
  "content": "Pernyataan pembicara secara mengalir...",
  "suggestedNextSpeaker": "manager" | "atlas" | "lyra" | "aegis" | "orion" | "echo" | "nova"
}
`;

  let promptUser = '';
  if (params.action === 'start') {
    promptUser = `
Agenda Rapat yang Ditentukan Bos Adrien:
"${params.agenda}"

Instruksi: Buka rapat ini sebagai Manager Utama. Sapa Bos Adrien dan tim, jelaskan tujuan agenda ini secara ringkas berbasis data live pipeline, lalu panggil staf pertama yang relevan untuk memberikan laporan awal.
`;
  } else if (params.bossInput) {
    promptUser = `
Agenda Rapat: "${params.agenda}"

Riwayat Percakapan Terakhir:
${formattedHistory || '(Belum ada percakapan)'}

🚨 BOS ADRIEN FANDRA BARU SAJA BERBICARA / MEMBERI ARAHAN:
"${params.bossInput}"

Instruksi: Pilih pembicara yang paling tepat (Manager Utama atau staf yang relevan dengan pertanyaan/arahan Bos). Tanggapi arahan Bos Adrien dengan tuntas dan cerdas!
`;
  } else {
    promptUser = `
Agenda Rapat: "${params.agenda}"

Riwayat Percakapan Terakhir:
${formattedHistory || '(Belum ada percakapan)'}

Pembicara Terakhir: ${lastSpeaker ? BOARDROOM_ROSTER[lastSpeaker]?.name : 'Belum ada'}

Instruksi: Lanjutkan dialog rapat secara alami! Pilih pembicara berikutnya dari staf AI yang paling relevan untuk menanggapi poin pembicara sebelumnya (bisa mengajukan pertanyaan, memberikan evaluasi data, atau menyodorkan solusi taktis). Jangan memilih pembicara yang sama dengan pembicara terakhir kecuali Manager yang merangkum.
`;
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey, apiVersion: 'v1beta' });
  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.8-flash',
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
            parts: [{ text: `${systemPrompt}\n\n${promptUser}` }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });
      rawJson = response.text || '';
      if (rawJson) break;
    } catch (e: any) {
      console.warn(`[Boardroom] Model ${model} gagal: ${e.message}. Mencoba model alternatif...`);
      lastError = e;
    }
  }

  if (!rawJson) {
    throw lastError || new Error('Gagal menghubungi model AI untuk dialog ruang rapat.');
  }

  let parsed: any = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error('[Boardroom] Gagal parse JSON:', rawJson);
    parsed = {
      speakerId: 'manager',
      replyingToId: 'boss',
      type: 'report',
      content: 'Rapat berjalan lancar, Bos Adrien. Tim sedang mereview data terbaru untuk memastikan seluruh proses optimal.',
      suggestedNextSpeaker: 'atlas',
    };
  }

  const speakerId: ParticipantId = parsed.speakerId && BOARDROOM_ROSTER[parsed.speakerId as ParticipantId]
    ? (parsed.speakerId as ParticipantId)
    : 'manager';

  const replyingToId: ParticipantId | null = parsed.replyingToId && BOARDROOM_ROSTER[parsed.replyingToId as ParticipantId]
    ? (parsed.replyingToId as ParticipantId)
    : null;

  const speakerMeta = BOARDROOM_ROSTER[speakerId];
  const replyingToMeta = replyingToId ? BOARDROOM_ROSTER[replyingToId] : null;

  const message: BoardroomMessage = {
    id: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    speakerId,
    speakerName: speakerMeta.name,
    speakerRole: speakerMeta.role,
    avatarColor: speakerMeta.avatarColor,
    content: parsed.content || 'Siap, kita lanjutkan koordinasi ini.',
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    replyingToId,
    replyingToName: replyingToMeta ? replyingToMeta.name : null,
    type: parsed.type || 'report',
  };

  const suggestedNextSpeaker: ParticipantId = parsed.suggestedNextSpeaker && BOARDROOM_ROSTER[parsed.suggestedNextSpeaker as ParticipantId]
    ? (parsed.suggestedNextSpeaker as ParticipantId)
    : 'lyra';

  return {
    success: true,
    message,
    suggestedNextSpeaker,
    allQuietForBoss: false,
  };
}
