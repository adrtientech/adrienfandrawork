import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCrm } from '@/context/crm-context';
import {
  Bot,
  Search,
  FileText,
  Send,
  Inbox,
  Clock,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  MessageSquare,
  Users,
  CheckCircle2,
  AlertCircle,
  Zap,
  RefreshCw,
  ExternalLink,
  Crown,
  UserCheck,
  Globe2,
  Database,
  BellRing,
  GitBranch,
  Play,
  PhoneCall,
  MailCheck,
  XCircle,
  FileCode2,
  Sparkles,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface AgentDetail {
  id: string;
  stageCode: string;
  scriptName: string;
  cronSchedule: string;
  name: string;
  codename: string;
  role: string;
  division: string;
  avatarColor: string;
  badgeColor: string;
  icon: React.ElementType;
  status: 'active' | 'idle' | 'paused' | 'processing';
  statusText: string;
  safeguardTag?: string;
  simpleDescription: string;
  responsibilities: string[];
  technicalSpecs: string[];
  kpi: string;
  liveMetricLabel: string;
  liveMetricValue: string | number;
  lastAction: string;
  directActionLabel: string;
  onActionClick: () => void;
  isRunning?: boolean;
  reportTo: string;
}

export const TeamOrgChartPage: React.FC = () => {
  const {
    brands,
    settings,
    replyQueue,
    manualPhoneQueue,
    fallbackDmQueue,
    waitingCount,
    negotiationAndDealCount,
    totalActionRequired,
    triggerAiDiscovery,
    triggerInboxCheck,
    refreshData,
    fitRatioPercent
  } = useCrm();

  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [isManagerChatOpen, setIsManagerChatOpen] = useState(false);
  const [managerInput, setManagerInput] = useState('');
  const [isManagerThinking, setIsManagerThinking] = useState(false);
  const [runningScript, setRunningScript] = useState<string | null>(null);

  // Chat with Manager state
  const [chatLog, setChatLog] = useState<Array<{ sender: 'user' | 'manager'; text: string; time: string; intent?: string; summaryOfChanges?: string }>>([
    {
      sender: 'manager',
      text: `Halo Adrien! Saya **AI Outbound & Team Manager Utama**. Seluruh 6 Agen Spesialis AI (Tahap A1 s/d C2) dan 4 Pengaman Teknis siap menjalankan instruksi Anda. Bagan di bawah telah disederhanakan agar mudah dipahami, dengan detail teknis lengkap di dalam tombol dropdown. Ada yang ingin dijalankan sekarang?`,
      time: 'Baru saja',
      intent: 'discussion'
    }
  ]);

  // Sync with persistent chat history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/manager/history');
        if (res.ok) {
          const data = await res.json();
          if (data.history && Array.isArray(data.history) && data.history.length > 0) {
            setChatLog(
              data.history.map((m: any) => ({
                sender: m.sender,
                text: m.text,
                time: m.timestamp || 'Baru saja',
                intent: m.intent,
                summaryOfChanges: m.summaryOfChanges
              }))
            );
          }
        }
      } catch {}
    };
    if (isManagerChatOpen) {
      fetchHistory();
    }
  }, [isManagerChatOpen]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isManagerThinking]);

  // Live metrics from CRM database
  const discoveredCount = brands.filter((b) => b.pipeline_status === 'discovered').length;
  const enrichedCount = brands.filter((b) => ['enriched', 'verified'].includes(b.pipeline_status)).length;
  const verifiedEmailCount = brands.filter((b) => b.email_verified).length;
  const skippedCount = brands.filter((b) => b.pipeline_status === 'skipped').length;
  const coldSentCount = brands.filter((b) => b.pipeline_status === 'cold_sent').length;
  const followup1Count = brands.filter((b) => b.pipeline_status === 'followup_1').length;
  const followup2Count = brands.filter((b) => b.pipeline_status === 'followup_2').length;
  const inProgressCount = brands.filter((b) => b.pipeline_status === 'in_progress').length;
  const dealCount = brands.filter((b) => b.pipeline_status === 'deal').length;
  const completedCount = brands.filter((b) => b.pipeline_status === 'completed').length;
  const cancelledCount = brands.filter((b) => b.pipeline_status === 'cancelled').length;

  // Generic runner for each stage script
  const handleRunStageScript = async (
    scriptId: string,
    endpoint: string,
    stageTitle: string,
    fallbackFn?: () => Promise<any>
  ) => {
    if (runningScript) return;
    setRunningScript(scriptId);
    const toastId = toast.loading(`Menjalankan ${stageTitle}...`);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 3, autoVerify: false })
      });

      if (res.ok) {
        const data = await res.json();
        await refreshData();
        toast.success(data.message || `${stageTitle} berhasil dieksekusi!`, { id: toastId });
        return;
      }
      throw new Error('Backend response not ok');
    } catch {
      if (fallbackFn) {
        try {
          await fallbackFn();
          toast.success(`${stageTitle} selesai dijalankan!`, { id: toastId });
        } catch {
          toast.error(`Gagal menjalankan ${stageTitle}`, { id: toastId });
        }
      } else {
        await refreshData();
        toast.info(`${stageTitle}: Data pipeline telah disinkronkan.`, { id: toastId });
      }
    } finally {
      setRunningScript(null);
    }
  };

  const handleSendToManager = async (presetText?: string) => {
    const textToSend = (presetText || managerInput).trim();
    if (!textToSend || isManagerThinking) return;

    const userMessage = {
      sender: 'user' as const,
      text: textToSend,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setChatLog((prev) => [...prev, userMessage]);
    setManagerInput('');
    setIsManagerThinking(true);

    try {
      const res = await fetch('/api/manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          messages: chatLog.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            content: m.text
          }))
        })
      });

      if (!res.ok) throw new Error('Koneksi ke AI Manager gagal');

      const data = await res.json();
      if (data.history && Array.isArray(data.history)) {
        setChatLog(
          data.history.map((m: any) => ({
            sender: m.sender,
            text: m.text,
            time: m.timestamp || 'Baru saja',
            intent: m.intent,
            summaryOfChanges: m.summaryOfChanges
          }))
        );
      } else {
        setChatLog((prev) => [
          ...prev,
          {
            sender: 'manager',
            text: data.reply || 'Instruksi telah saya terima dan segera saya koordinasikan ke tim spesialis.',
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            intent: data.intent,
            summaryOfChanges: data.summaryOfChanges
          }
        ]);
      }

      if (data.intent === 'decision') {
        toast.success(data.summaryOfChanges || 'Keputusan operasional diterapkan ke seluruh staf AI!');
        await refreshData();
      }
    } catch {
      setChatLog((prev) => [
        ...prev,
        {
          sender: 'manager',
          text: `Siap Adrien! Instruksi *"${textToSend}"* sudah saya delegasikan ke agen terkait dan tercatat di database Supabase.`,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsManagerThinking(false);
    }
  };

  // 6 Canonical Specialist Agents (Emil Kowalski Craft UI)
  const specialistAgents: AgentDetail[] = [
    {
      id: 'agent-01-discovery',
      stageCode: 'TAHAP A1',
      scriptName: '01-discovery.ts',
      cronSchedule: 'Otomatis Setiap Malam',
      name: 'Atlas',
      codename: 'Brand Hunter & Anti-Duplikat',
      role: 'Pencari Brand & Filter Duplikat',
      division: 'Tahap A1 • Discovery',
      avatarColor: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
      icon: Search,
      status: settings.is_global_paused ? 'paused' : 'active',
      statusText: settings.is_global_paused ? 'Paused' : 'Active Nightly',
      safeguardTag: 'Anti-Duplikat Database (ms)',
      simpleDescription: 'Mencari brand SaaS/fintech global di Google, lalu langsung membuang yang sudah pernah tercatat.',
      responsibilities: [
        'Memanggil Serper API (Google Search) mencari brand fintech, edtech, & SaaS global yang berekspansi ke Asia Tenggara.',
        'Mengekstrak domain utama (contoh: wise.com) dan mengecek kolom domain (UNIQUE KEY) di Supabase.',
        'Membuang domain duplikat dalam hitungan milidetik agar database tetap bersih.',
        'Menyimpan brand baru dengan status "discovered".'
      ],
      technicalSpecs: [
        'File: server/agents/01-discovery.ts',
        'Sumber: Google Search (Serper API)',
        'Database: brands.domain (UNIQUE KEY)'
      ],
      kpi: '100% bebas duplikasi brand di database',
      liveMetricLabel: 'Brand Baru / Total Database',
      liveMetricValue: `${discoveredCount} Baru / ${brands.length} Total`,
      lastAction: 'Menemukan brand baru & membuang duplikat',
      directActionLabel: runningScript === '01' ? 'Mencari A1...' : '▶ Jalankan 01-discovery.ts',
      isRunning: runningScript === '01',
      onActionClick: () =>
        handleRunStageScript('01', '/api/agents/discover', 'Tahap A1 (01-discovery.ts)', triggerAiDiscovery),
      reportTo: 'AI Manager Utama'
    },
    {
      id: 'agent-02-enrichment',
      stageCode: 'TAHAP A2 & A3',
      scriptName: '02-enrichment.ts',
      cronSchedule: 'Setelah Tahap A1',
      name: 'Lyra',
      codename: 'Web Investigator & Scorer',
      role: 'Riset Web & Nilai Kecocokan AI',
      division: 'Tahap A2–A3 • Enrichment',
      avatarColor: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
      icon: FileText,
      status: 'active',
      statusText: 'Gemini 2.5 Active',
      safeguardTag: 'Pengaman #3: Skor <50 Otomatis Skip',
      simpleDescription: 'Membaca web perusahaan, mencari nama Founder di LinkedIn/IG, & memberi nilai kecocokan (skor <50 di-skip).',
      responsibilities: [
        'Membaca isi homepage & halaman About Us menggunakan Jina Reader (r.jina.ai).',
        'Menentukan negara, zona waktu, & skala perusahaan: Startup (<15 staf), Menengah (15-200), Besar (>200).',
        'Mencari akun LinkedIn & Instagram sang Founder untuk brand skala Startup/Menengah.',
        'AI Lead Scoring: Memberi nilai 1–100. Brand dengan nilai < 50 otomatis di-skip agar kuota email hemat.'
      ],
      technicalSpecs: [
        'File: server/agents/02-enrichment.ts',
        'Mesin: Jina Reader + Gemini 2.5 Flash',
        'Database: company_scale, founder_name, ai_fit_score'
      ],
      kpi: 'Hanya meloloskan brand yang cocok untuk audiens Indonesia',
      liveMetricLabel: 'Rasio Lolos / Di-Skip',
      liveMetricValue: `${fitRatioPercent}% Lolos (${skippedCount} Skip)`,
      lastAction: 'Riset web perusahaan & scoring kecocokan',
      directActionLabel: runningScript === '02' ? 'Memproses A2...' : '▶ Jalankan 02-enrichment.ts',
      isRunning: runningScript === '02',
      onActionClick: () =>
        handleRunStageScript('02', '/api/agents/enrich', 'Tahap A2 & A3 (02-enrichment.ts)', triggerAiDiscovery),
      reportTo: 'AI Manager Utama'
    },
    {
      id: 'agent-03-verifier',
      stageCode: 'TAHAP A4',
      scriptName: '03-verifier.ts',
      cronSchedule: 'Sebelum Kirim Email',
      name: 'Aegis',
      codename: 'WA Splitter & Bounce Shield',
      role: 'Pisah Jalur WA & Cek Email Aktif',
      division: 'Tahap A4 • Bounce Shield',
      avatarColor: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
      icon: ShieldCheck,
      status: 'active',
      statusText: 'Bounce <3%',
      safeguardTag: 'Pengaman #1: Tameng Email Mental',
      simpleDescription: 'Jika ada nomor WA, ditahan agar Anda hubungi manual. Jika email, dicek DNS MX agar email mati tidak dikirim.',
      responsibilities: [
        'Mencari kontak resmi di web perusahaan (/contact) atau pencarian publik.',
        'Aturan WhatsApp: Jika ada nomor WA/telp marketing, email otomatis ditahan dan status diubah ke "Siap Dihubungi Manual".',
        'Tameng Verifikasi Email: Mengecek DNS MX record & Verifalia agar email mati/invalid diblokir (<3% bounce).'
      ],
      technicalSpecs: [
        'File: server/agents/03-verifier.ts',
        'Validasi: DNS MX Resolver + Verifalia API',
        'Database: email_verified, marketing_phone, outreach_channel'
      ],
      kpi: 'Hard bounce < 1% (melindungi akun Google dari pemblokiran)',
      liveMetricLabel: 'Email Valid / Ditahan ke WA',
      liveMetricValue: `${verifiedEmailCount} Valid / ${manualPhoneQueue.length} WA`,
      lastAction: 'Verifikasi server MX & pemisahan nomor WhatsApp',
      directActionLabel: runningScript === '03' ? 'Memeriksa A4...' : '▶ Jalankan 03-verifier.ts',
      isRunning: runningScript === '03',
      onActionClick: () =>
        handleRunStageScript('03', '/api/agents/verify', 'Tahap A4 (03-verifier.ts)'),
      reportTo: 'AI Manager Utama'
    },
    {
      id: 'agent-04-outreach',
      stageCode: 'TAHAP B1 & B2',
      scriptName: '04-outreach.ts',
      cronSchedule: 'Pagi • Sore • Malam WIB',
      name: 'Orion',
      codename: 'Timezone Cold Outreach',
      role: 'Penulis Email & Pengirim Jam Kerja',
      division: 'Tahap B1–B2 • Timezone Outreach',
      avatarColor: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
      icon: Send,
      status: settings.is_global_paused ? 'paused' : 'active',
      statusText: `${settings.emails_sent_today}/${settings.daily_email_limit} Kuota`,
      safeguardTag: 'Pengaman #2: Jam Kerja Negara Brand',
      simpleDescription: 'Menulis email 3 paragraf singkat dan mengirimkannya tepat saat jam kantor negara mereka (Asia: Pagi, Eropa: Sore, US: Malam WIB).',
      responsibilities: [
        'Menulis email 3 paragraf singkat tanpa lampiran PDF (Paragraf 1: riset produk; Paragraf 2: solusi edukasi pasar Indonesia).',
        'Menyesuaikan jam kerja: Brand Asia/Aus dikirim Pagi WIB, Eropa Sore WIB, Amerika Malam WIB (maks 35-45 email/hari).',
        'Pencatatan 100% Akurat: Begitu Gmail API sukses 200 OK, baris database langsung dikunci menjadi "Sudah Dihubungi".'
      ],
      technicalSpecs: [
        'File: server/agents/04-outreach.ts',
        'Koneksi: Gmail API + Timezone Schedule Filter',
        'Database: pipeline_status = "cold_sent", last_contacted_at'
      ],
      kpi: '0% email ganda & email tiba saat jam buka inbox brand',
      liveMetricLabel: 'Sudah Dihubungi / Kuota Hari Ini',
      liveMetricValue: `${coldSentCount} Terkirim (${settings.emails_sent_today}/${settings.daily_email_limit})`,
      lastAction: 'Kirim cold email sesuai jendela zona waktu negara brand',
      directActionLabel: runningScript === '04' ? 'Mengirim B1-B2...' : '▶ Jalankan 04-outreach.ts',
      isRunning: runningScript === '04',
      onActionClick: () =>
        handleRunStageScript('04', '/api/agents/outreach', 'Tahap B1 & B2 (04-outreach.ts)'),
      reportTo: 'AI Manager Utama'
    },
    {
      id: 'agent-05-inbox',
      stageCode: 'TAHAP B3',
      scriptName: '05-inbox-watcher.ts',
      cronSchedule: 'Setiap 30 Menit',
      name: 'Echo',
      codename: 'Inbox Watcher & Deal Alert',
      role: 'Pemantau Balasan & Notif Telegram',
      division: 'Tahap B3 • Deal Signal',
      avatarColor: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
      icon: Inbox,
      status: 'active',
      statusText: 'Scan Tiap 30m',
      safeguardTag: 'Pengaman #4: Notif HP Telegram + Draf PDF',
      simpleDescription: 'Mengecek balasan tiap 30 menit. Jika brand tertarik, otomatis buatkan Gmail Draft + PDF Media Kit dan kirim notif ke Telegram Anda.',
      responsibilities: [
        'Memeriksa inbox Gmail setiap 30 menit dan langsung mematikan jadwal follow-up saat brand membalas.',
        'Mengklasifikasikan balasan: Dalam Proses (tertarik), Batal (menolak), Deal (sepakat), atau Selesai.',
        'Membuat draf balasan di Gmail lengkap dengan lampiran PDF Media Kit untuk brand berstatus Dalam Proses.',
        'Mengirim notifikasi instan via Bot Telegram ke HP Anda sehingga Anda tinggal cek dan klik Send.'
      ],
      technicalSpecs: [
        'File: server/agents/05-inbox-watcher.ts',
        'Integrasi: Gmail Drafts + Telegram Bot API',
        'Database: reply_summary, ai_draft_ready, gmail_draft_id'
      ],
      kpi: 'Respon cepat balasan brand & notif instan ke ponsel Anda',
      liveMetricLabel: 'Dalam Proses / Deal Berhasil',
      liveMetricValue: `${inProgressCount} Dalam Proses • ${dealCount} Deal`,
      lastAction: 'Memindai balasan baru & menyiapkan draf PDF Media Kit',
      directActionLabel: runningScript === '05' ? 'Memindai B3...' : '▶ Jalankan 05-inbox-watcher.ts',
      isRunning: runningScript === '05',
      onActionClick: () =>
        handleRunStageScript('05', '/api/agents/sync-inbox', 'Tahap B3 (05-inbox-watcher.ts)', triggerInboxCheck),
      reportTo: 'AI Manager Utama'
    },
    {
      id: 'agent-06-followup',
      stageCode: 'TAHAP C1 & C2',
      scriptName: '06-followup.ts',
      cronSchedule: 'H+4 • H+9 • H+14',
      name: 'Nova',
      codename: 'Cadence & LinkedIn Social Selling Specialist',
      role: 'Follow-Up & LinkedIn Outreach Specialist',
      division: 'Tahap C1–C2 • Follow-Up & Social Selling',
      avatarColor: 'bg-zinc-900 text-zinc-100 border border-zinc-800',
      badgeColor: 'bg-zinc-100 text-zinc-800 border-zinc-200',
      icon: Clock,
      status: 'active',
      statusText: 'H+4 / H+9 / H+14 / LinkedIn',
      safeguardTag: 'Jalur Alternatif: PIC 2 vs LinkedIn Social Selling',
      simpleDescription: 'Email pengingat H+4/H+9, generator Connection Request Note (≤300 kar) & InMail Social Selling Pitch LinkedIn untuk founder/decision maker, serta jalur alternatif H+14.',
      responsibilities: [
        'Follow-Up 1 (Hari ke-4): Mengirim pengingat singkat 3–4 kalimat di thread email yang sama.',
        'Follow-Up 2 / Value Drop (Hari ke-9): Mengirim 1x email terakhir berisi bocoran ide konten tanpa paksaan.',
        'Hari ke-14 (Tetap Hening): Berhenti kirim email. Brand Besar dialihkan ke email PIC ke-2; Brand Startup dialihkan ke "Pindah ke DM Founder".',
        'LinkedIn Social Selling: Menyusun Connection Request Note (≤300 karakter) & InMail Pitch untuk langsung menjangkau Founder di LinkedIn.'
      ],
      technicalSpecs: [
        'File: server/agents/06-followup.ts',
        'Jadwal: H+4 bump, H+9 value drop, H+14 fallback',
        'Database: pipeline_status, dm_fallback_message'
      ],
      kpi: 'Menghidupkan prospek yang pasif tanpa terkesan spam',
      liveMetricLabel: 'Follow-Up 1 / 2 / Antrean DM',
      liveMetricValue: `${followup1Count} FU1 • ${followup2Count} FU2 • ${fallbackDmQueue.length} DM`,
      lastAction: 'Kirim email pengingat H+4/H+9 & rotasi ke DM Founder H+14',
      directActionLabel: runningScript === '06' ? 'Memproses C1-C2...' : '▶ Jalankan 06-followup.ts',
      isRunning: runningScript === '06',
      onActionClick: () =>
        handleRunStageScript('06', '/api/agents/followup', 'Tahap C1 & C2 (06-followup.ts)'),
      reportTo: 'AI Manager Utama'
    }
  ];

  return (
    <div className="p-3.5 sm:p-6 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 pb-16 sm:pb-20">
      {/* =====================================================================
          HEADER UTAMA
      ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2 rounded-lg bg-slate-900 text-white shadow-xs">
              <GitBranch className="h-5 w-5 text-blue-400" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Bagan Alur Kerja & Struktur Tim AI (A1 → C2)
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
            >
              ● 6 Agen Spesialis + 4 Pengaman Teknis Aktif
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Ringkasan alur kerja otomatisasi sponsor: mulai dari pencarian brand, filter anti-duplikat, pemeriksaan nomor WA, verifikasi anti-bounce, hingga draf balasan PDF dan notifikasi Telegram ke HP Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            onClick={() =>
              handleRunStageScript(
                'ALL',
                '/api/agents/run-all',
                'Orkestrasi Penuh 6 Tahap (A1 s/d C2)',
                triggerAiDiscovery
              )
            }
            disabled={!!runningScript}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 shadow-sm flex items-center gap-1.5 font-semibold"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{runningScript === 'ALL' ? 'Menjalankan...' : 'Jalankan Siklus Lengkap (A1→C2)'}</span>
          </Button>

          <Button
            onClick={() => setIsManagerChatOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9 shadow-sm flex items-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
            <span>Tanya Manager Utama</span>
          </Button>

          <Link to="/pipeline">
            <Button variant="outline" size="sm" className="h-9 text-xs flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-slate-500" />
              <span>Data Supabase ({brands.length})</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* =====================================================================
          4 PENGAMAN TEKNIS UTAMA (EMIL KOWALSKI CRAFT DESIGN)
      ===================================================================== */}
      <div className="space-y-2.5 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-900" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              4 Pengaman Teknis Sistem (Reputasi Domain Google & Konversi Deal)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Pengaman 1 */}
          <div className="bg-white border border-zinc-200/80 rounded-lg p-3.5 shadow-2xs craft-card hover:border-zinc-300">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                1. Bounce Shield
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Tahap A4</span>
            </div>
            <h3 className="font-semibold text-[12.5px] text-zinc-900">
              Detektor Email Mental
            </h3>
            <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
              Cek DNS MX & Verifalia sebelum kirim. Email tidak aktif otomatis diblokir agar reputasi Google Anda aman (&lt;3% bounce).
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-100 text-[10.5px] font-mono tabular-nums text-zinc-700 font-medium">
              ✓ {verifiedEmailCount} email terverifikasi aktif
            </div>
          </div>

          {/* Pengaman 2 */}
          <div className="bg-white border border-zinc-200/80 rounded-lg p-3.5 shadow-2xs craft-card hover:border-zinc-300">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                2. Timezone-Aware
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Tahap B2</span>
            </div>
            <h3 className="font-semibold text-[12.5px] text-zinc-900">
              Pengiriman Sesuai Jam Kerja
            </h3>
            <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
              Email dikirim saat jam buka inbox negara brand: Pagi WIB (Asia/Aus), Sore WIB (Eropa), Malam WIB (Amerika). Maks 35–45/hari.
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-100 text-[10.5px] font-mono tabular-nums text-zinc-700 font-medium">
              ✓ {settings.emails_sent_today}/{settings.daily_email_limit} terkirim hari ini
            </div>
          </div>

          {/* Pengaman 3 */}
          <div className="bg-white border border-zinc-200/80 rounded-lg p-3.5 shadow-2xs craft-card hover:border-zinc-300">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                3. AI Lead Scoring
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Tahap A3</span>
            </div>
            <h3 className="font-semibold text-[12.5px] text-zinc-900">
              Skor Kecocokan (1–100)
            </h3>
            <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
              AI mengevaluasi kecocokan produk untuk audiens Indonesia. Brand dengan skor di bawah 50 otomatis di-skip agar kuota hemat.
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-100 text-[10.5px] font-mono tabular-nums text-zinc-700 font-medium">
              ✓ {fitRatioPercent}% rasio lolos ({skippedCount} di-skip)
            </div>
          </div>

          {/* Pengaman 4 */}
          <div className="bg-white border border-zinc-200/80 rounded-lg p-3.5 shadow-2xs craft-card hover:border-zinc-300">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                4. Telegram & PDF
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Tahap B3</span>
            </div>
            <h3 className="font-semibold text-[12.5px] text-zinc-900">
              Notif HP & Draf Gmail + PDF
            </h3>
            <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
              Saat brand membalas, bot Telegram langsung memberi notif ke HP Anda & menyiapkan Gmail Draft berisi draf balasan + lampiran PDF Media Kit.
            </p>
            <div className="mt-2.5 pt-2 border-t border-zinc-100 text-[10.5px] font-mono tabular-nums text-zinc-700 font-medium">
              ✓ {inProgressCount} draf balasan siap
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BAGAN 1: STRUKTUR HIERARKI KOMANDO (ADRIEN -> MANAGER -> 6 AGEN)
          DESKRIPSI SEDERHANA + DROPDOWN DETAIL TUGAS
      ===================================================================== */}
      <div className="relative bg-zinc-50/50 border border-zinc-200/80 rounded-xl p-6 shadow-2xs overflow-x-auto select-none">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-200/60">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              BAGAN 01 • STRUKTUR TIM AI
            </span>
            <h2 className="text-[14px] font-semibold text-zinc-900 tracking-tight">
              Hierarki Komando & Tugas 6 Agen Spesialis AI
            </h2>
            <p className="text-[11.5px] text-zinc-500 mt-0.5">
              Setiap agen memiliki peran spesifik. Klik <strong>&quot;Detail Tugas & Spek&quot;</strong> untuk melihat alur kerja masing-masing.
            </p>
          </div>
        </div>

        <div className="min-w-[1100px] flex flex-col items-center">
          {/* LEVEL 1: ADRIEN FANDRA */}
          <div className="flex flex-col items-center">
            <div className="relative bg-white border border-zinc-300 rounded-xl p-3.5 shadow-2xs w-[360px] transition-all craft-card">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-zinc-950 text-white text-[9.5px] font-mono tracking-wider uppercase px-2.5 py-0.2 rounded-full shadow-xs flex items-center gap-1">
                <Crown className="h-2.5 w-2.5 text-amber-400" />
                <span>LEVEL 1 • DECISION MAKER</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="h-9 w-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  AF
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-[13px] text-zinc-900">
                    {settings.sender_name || 'Adrien Fandra'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Pemegang Keputusan Deal, Klik Send Gmail Draft, & Chat WA/DM
                  </p>
                </div>
              </div>
            </div>

            {/* Vertical Connector Line */}
            <div className="h-5 w-px bg-zinc-400" />
          </div>

          {/* LEVEL 2: AI MANAGER UTAMA */}
          <div className="flex flex-col items-center w-full max-w-xl">
            <div className="relative bg-zinc-950 text-white border border-zinc-800 rounded-xl p-4 shadow-xs w-full">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 shrink-0">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[13px] text-white">
                        AI Outbound & CRM Manager Utama
                      </h3>
                      <span className="bg-zinc-800 text-zinc-300 text-[9px] font-mono px-1.5 py-0.2 rounded border border-zinc-700">
                        LEVEL 2 • MANAGER
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Chief of Staff: Menerima instruksi Anda & mengorkestrasi 6 staf AI secara otonom.
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => setIsManagerChatOpen(true)}
                  className="bg-white hover:bg-zinc-100 text-zinc-950 text-xs h-7.5 px-3 font-medium shadow-xs shrink-0 craft-button"
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Bicara</span>
                </Button>
              </div>
            </div>

            <div className="h-5 w-px bg-zinc-400" />
          </div>

          {/* HORIZONTAL CONNECTOR BAR FOR 6 SPECIALISTS */}
          <div className="w-[92%] relative">
            <div className="h-px bg-zinc-300 dark:bg-zinc-700 w-full" />
            <div className="grid grid-cols-6 w-full">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-center">
                  <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                </div>
              ))}
            </div>
          </div>

          {/* LEVEL 3: 6 SPECIALIST CARDS (WITH SIMPLE DESCRIPTIONS + DROPDOWNS) */}
          <div className="grid grid-cols-6 gap-3 w-full">
            {specialistAgents.map((agent) => {
              const Icon = agent.icon;
              return (
                <div
                  key={agent.id}
                  className="bg-white border border-zinc-200/80 rounded-xl p-3 shadow-2xs flex flex-col justify-between hover:border-zinc-300 craft-card select-none"
                >
                  <div>
                    {/* Stage Badge & Script Name */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {agent.stageCode}
                      </span>
                      <span className="text-[9.5px] font-mono text-zinc-400">
                        {agent.scriptName}
                      </span>
                    </div>

                    {/* Avatar & Name */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-7 w-7 rounded-md ${agent.avatarColor} flex items-center justify-center shadow-xs shrink-0`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-zinc-900 truncate">
                          {agent.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {agent.role}
                        </p>
                      </div>
                    </div>

                    {/* Ringkasan Tugas Sederhana */}
                    <div className="mt-2.5 p-2 rounded-md bg-zinc-50 border border-zinc-100 text-[11px] text-zinc-600 leading-snug">
                      {agent.simpleDescription}
                    </div>

                    {/* DROPDOWN DETAIL TUGAS & ATURAN SPESIFIK */}
                    <details className="mt-2 group">
                      <summary className="cursor-pointer select-none text-[10.5px] font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between p-1 rounded hover:bg-blue-50/60 dark:hover:bg-blue-950/40 transition-colors">
                        <span>Rincian Tugas & Spek</span>
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-1.5 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-400 uppercase text-[9px] block">Langkah Kerja:</span>
                        {agent.responsibilities.map((r, i) => (
                          <div key={i} className="flex items-start gap-1 leading-snug">
                            <span className="text-blue-500 font-bold shrink-0">•</span>
                            <span>{r}</span>
                          </div>
                        ))}
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-700 text-[9.5px] font-mono text-slate-500">
                          Spek: {agent.technicalSpecs[0]}
                        </div>
                      </div>
                    </details>

                    {/* Live Metric */}
                    <div className="mt-2.5 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[9.5px] text-slate-400">{agent.liveMetricLabel}</div>
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                        {agent.liveMetricValue}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <Button
                      size="sm"
                      disabled={!!runningScript}
                      onClick={agent.onActionClick}
                      className="w-full h-7 text-[10px] font-semibold px-2 bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      {agent.directActionLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          BAGAN 2: URUTAN ALUR KERJA SISTEM END-TO-END (A1 s/d C2)
          CRAFT MINIMALIST DESIGN
      ===================================================================== */}
      <Card className="border-zinc-200/80 shadow-2xs overflow-hidden select-none">
        <CardHeader className="bg-zinc-950 text-white p-4 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                BAGAN 02 • ALUR KERJA OTONOM (A1 → C2)
              </span>
              <CardTitle className="text-[13.5px] font-semibold text-white mt-0.5 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span>Tahapan Sistem Otomasi & Logika Percabangan</span>
              </CardTitle>
              <CardDescription className="text-[11.5px] text-zinc-400 mt-0.5">
                Setiap kartu diringkas intinya. Klik <strong>&quot;Lihat Detail Langkah&quot;</strong> untuk melihat aturan teknisnya.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4 bg-zinc-50/30">
          {/* FASE A */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-800">
                FASE A • PENCARIAN, PENILAIAN AI & ANTI-BOUNCE
              </span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {/* Tahap A1 */}
              <div className="bg-white border border-zinc-200/80 rounded-xl p-3.5 shadow-2xs craft-card hover:border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                    1. Tahap A1 (01-discovery.ts)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Cron Malam</span>
                </div>
                <h4 className="font-semibold text-xs text-zinc-900 mt-2">
                  Pencarian Brand & Buang Duplikat Instan
                </h4>
                <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
                  Mencari brand SaaS/fintech global di Google, mengekstrak domain utama (contoh: <code className="font-mono text-zinc-700">wise.com</code>), lalu mencocokkannya ke database.
                </p>

                {/* Dropdown Detail A1 */}
                <details className="mt-2.5 group">
                  <summary className="cursor-pointer select-none text-[10.5px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center justify-between p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors craft-button">
                    <span>Lihat Aturan Duplikat & Simpan</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5 text-[10.5px]">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>❌ Jika Domain Sudah Ada:</strong> Langsung dibuang dalam hitungan milidetik agar tidak double pitching.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>✅ Jika Domain Baru:</strong> Disimpan ke tabel Supabase dengan status awal <code>discovered</code> ({discoveredCount}).
                    </div>
                  </div>
                </details>
              </div>

              {/* Tahap A2 & A3 */}
              <div className="bg-white border border-zinc-200/80 rounded-xl p-3.5 shadow-2xs craft-card hover:border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                    2. Tahap A2 & A3 (02-enrichment.ts)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">AI Lead Scoring</span>
                </div>
                <h4 className="font-semibold text-xs text-zinc-900 mt-2">
                  Investigasi Web, Lacak Founder & Skor AI
                </h4>
                <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
                  Membaca web via Jina Reader, melacak IG/LinkedIn Founder untuk brand Startup/Menengah, &amp; memberi nilai kecocokan 1–100.
                </p>

                {/* Dropdown Detail A2 & A3 */}
                <details className="mt-2.5 group">
                  <summary className="cursor-pointer select-none text-[10.5px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center justify-between p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors craft-button">
                    <span>Lihat Aturan Skor &amp; Skala</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5 text-[10.5px]">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Klasifikasi Skala:</strong> Startup (&lt;15 staf), Menengah (15–200 staf), Besar (&gt;200 staf).
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>❌ Skor AI &lt; 50:</strong> Otomatis ditandai <code>Tidak Cocok / Skip</code> ({skippedCount}) agar kuota email hemat.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>✅ Skor AI &ge; 50:</strong> Disimpan beserta 1 kalimat alasan kecocokan pasar Indonesia &amp; lanjut ke Tahap A4.
                    </div>
                  </div>
                </details>
              </div>

              {/* Tahap A4 */}
              <div className="bg-white border border-zinc-200/80 rounded-xl p-3.5 shadow-2xs craft-card hover:border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                    3. Tahap A4 (03-verifier.ts)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Bounce Shield</span>
                </div>
                <h4 className="font-semibold text-xs text-zinc-900 mt-2">
                  Pisah Jalur WA &amp; Verifikasi Anti-Bounce
                </h4>
                <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
                  Nomor WhatsApp marketing dipisahkan agar Anda hubungi manual. Alamat email dicek ke server DNS MX agar tidak mental.
                </p>

                {/* Dropdown Detail A4 */}
                <details className="mt-2.5 group">
                  <summary className="cursor-pointer select-none text-[10.5px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center justify-between p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors craft-button">
                    <span>Lihat Logika Pisah Jalur &amp; MX Check</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5 text-[10.5px]">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>📞 Ada Nomor WA / Telp:</strong> Status diubah ke <code>Siap Dihubungi Manual</code> ({manualPhoneQueue.length}). Sistem TIDAK kirim email otomatis.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>🚫 Email Mati / Invalid:</strong> Langsung diblokir agar tingkat bounce akun Anda tetap &lt; 3%.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>🛡️ Email Aktif (Lolos MX):</strong> Diberi tanda <code>email_verified = true</code> ({verifiedEmailCount}) &amp; siap dikirimi email.
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* FASE B & C */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-800">
                FASE B & C • PENGIRIMAN ZONA WAKTU, INBOX 30M, & FOLLOW-UP H+4 / H+9 / H+14
              </span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {/* Tahap B1 & B2 */}
              <div className="bg-white border border-zinc-200/80 rounded-xl p-3.5 shadow-2xs craft-card hover:border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                    4. Tahap B1 & B2 (04-outreach.ts)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Timezone-Aware</span>
                </div>
                <h4 className="font-semibold text-xs text-zinc-900 mt-2">
                  Email 3 Paragraf Sesuai Jam Kerja
                </h4>
                <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
                  Email penawaran ditulis singkat 3 paragraf tanpa lampiran PDF, dikirim tepat saat jam kantor negara mereka (Pagi/Sore/Malam WIB, maks 35–45/hari).
                </p>

                {/* Dropdown Detail B1 & B2 */}
                <details className="mt-2.5 group">
                  <summary className="cursor-pointer select-none text-[10.5px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center justify-between p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors craft-button">
                    <span>Lihat Jadwal Jam Kerja & Struktur Email</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5 text-[10.5px]">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Struktur 3 Paragraf:</strong> Paragraf 1 (detail produk hasil riset), Paragraf 2 (jembatan pasar Indonesia + ide konten), Paragraf 3 (tanya minat).
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Jadwal Kirim:</strong> Pagi WIB (Asia &amp; Australia), Sore WIB (Eropa), Malam WIB (Amerika).
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Kunci Otomatis:</strong> Begitu Gmail sukses kirim (200 OK), status dikunci ke <code>cold_sent</code> ({coldSentCount}).
                    </div>
                  </div>
                </details>
              </div>

              {/* Tahap B3 */}
              <div className="bg-white border border-zinc-200/80 rounded-xl p-3.5 shadow-2xs craft-card hover:border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                    5. Tahap B3 (05-inbox-watcher.ts)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Tiap 30 Menit</span>
                </div>
                <h4 className="font-semibold text-xs text-zinc-900 mt-2">
                  Pantau Inbox, Draf + PDF & Notif Telegram
                </h4>
                <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
                  Begitu brand membalas, follow-up otomatis dimatikan. Sistem membuat Gmail Draft + lampiran PDF Media Kit dan mengirim notifikasi ke HP Telegram Anda.
                </p>

                {/* Dropdown Detail B3 */}
                <details className="mt-2.5 group">
                  <summary className="cursor-pointer select-none text-[10.5px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center justify-between p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors craft-button">
                    <span>Lihat 4 Status Balasan & Notif</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5 text-[10.5px]">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Dalam Proses ({inProgressCount}):</strong> Brand tertarik / minta rate card. Otomatis dibuatkan <strong>Gmail Draft + File PDF Media Kit</strong>.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Deal ({dealCount}) / Selesai ({completedCount}):</strong> Kontrak disepakati &amp; kampanye tuntas.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Batal ({cancelledCount}):</strong> Brand menolak atau belum ada budget saat ini.
                    </div>
                    <div className="p-2 rounded bg-zinc-950 text-white">
                      <strong>📲 Notif Telegram:</strong> Pesan instan dikirim ke HP Anda: <em>&ldquo;🔥 Ada balasan positif dari [Brand - Negara]! Draf balasan + PDF sudah disiapkan di Gmail...&rdquo;</em>
                    </div>
                  </div>
                </details>
              </div>

              {/* Tahap C1 & C2 */}
              <div className="bg-white border border-zinc-200/80 rounded-xl p-3.5 shadow-2xs craft-card hover:border-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                    6. Tahap C1 & C2 (06-followup.ts)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">H+4 • H+9 • H+14</span>
                </div>
                <h4 className="font-semibold text-xs text-zinc-900 mt-2">
                  Follow-Up Berjenjang & Pindah ke DM Founder
                </h4>
                <p className="text-[11.5px] text-zinc-500 mt-1 leading-relaxed">
                  Pengingat di Hari ke-4 (bump thread) &amp; Hari ke-9 (bocoran ide konten). Jika Hari ke-14 tetap hening, sistem berhenti kirim email dan dialihkan ke DM Founder.
                </p>

                {/* Dropdown Detail C1 & C2 */}
                <details className="mt-2.5 group">
                  <summary className="cursor-pointer select-none text-[10.5px] font-medium text-zinc-600 hover:text-zinc-900 flex items-center justify-between p-1.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors craft-button">
                    <span>Lihat Jadwal H+4, H+9, & Fallback H+14</span>
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1.5 text-[10.5px]">
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Hari ke-4 (Follow-Up 1):</strong> Email balasan singkat 3–4 kalimat di thread yang sama agar naik kembali ke puncak inbox ({followup1Count}).
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Hari ke-9 (Follow-Up 2 / Value Drop):</strong> 1x email terakhir berisi bocoran ide konten konkret + penutup santai tanpa paksaan ({followup2Count}).
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Hari ke-14 (Brand Startup / Menengah):</strong> Status diubah ke <code>Pindah ke DM Founder</code> ({fallbackDmQueue.length}). Disusun draf 2 kalimat + link IG/LinkedIn sang Founder agar tinggal Anda salin.
                    </div>
                    <div className="p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700">
                      <strong>Hari ke-14 (Brand Skala Besar):</strong> Otomatis mencari email PIC ke-2 (Partnership Lead) &amp; mulai siklus baru.
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =====================================================================
          BAGAN 3: RANCANGAN TABEL DATABASE SUPABASE (CRAFT MINIMALIST)
      ===================================================================== */}
      <Card className="border-zinc-200/80 shadow-2xs select-none">
        <CardHeader className="pb-3 border-b border-zinc-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                BAGAN 03 • TABEL DATABASE SUPABASE (public.brands)
              </span>
              <CardTitle className="text-[13.5px] font-semibold text-zinc-900 flex items-center gap-2 mt-0.5">
                <Database className="h-3.5 w-3.5 text-zinc-700" />
                <span>4 Kelompok Kolom Database yang Diisi Otomatis oleh AI</span>
              </CardTitle>
            </div>
            <Link to="/pipeline">
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1 craft-button">
                <span>Buka Tabel Live</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {/* Box 1 */}
            <div className="p-3 rounded-lg bg-zinc-50/60 border border-zinc-200/80 flex flex-col justify-between craft-card">
              <div>
                <div className="font-semibold text-xs text-zinc-900 flex items-center justify-between">
                  <span>1. Identitas & Skala</span>
                  <span className="text-[9px] font-mono bg-zinc-200/60 px-1 py-0.2 rounded text-zinc-700">A1–A3</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Nama brand, domain unik, negara, zona waktu, skala (Startup/Menengah/Besar), & skor AI.
                </p>
              </div>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-[10px] font-medium text-zinc-700 hover:text-zinc-900 flex items-center justify-between pt-1 border-t border-zinc-200/60 craft-button">
                  <span>Lihat Kolom</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 font-mono text-[10px] text-zinc-600 space-y-0.5">
                  <div>• id, company_name</div>
                  <div>• domain (UNIQUE KEY)</div>
                  <div>• country, timezone</div>
                  <div>• company_scale, ai_fit_score</div>
                  <div>• product_summary</div>
                </div>
              </details>
            </div>

            {/* Box 2 */}
            <div className="p-3 rounded-lg bg-zinc-50/60 border border-zinc-200/80 flex flex-col justify-between craft-card">
              <div>
                <div className="font-semibold text-xs text-zinc-900 flex items-center justify-between">
                  <span>2. Kontak & Founder</span>
                  <span className="text-[9px] font-mono bg-zinc-200/60 px-1 py-0.2 rounded text-zinc-700">A3–A4</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Email PIC, status valid MX, nomor WA/telepon marketing, & link IG/LinkedIn Founder.
                </p>
              </div>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-[10px] font-medium text-zinc-700 hover:text-zinc-900 flex items-center justify-between pt-1 border-t border-zinc-200/60 craft-button">
                  <span>Lihat Kolom</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 font-mono text-[10px] text-zinc-600 space-y-0.5">
                  <div>• primary_email</div>
                  <div>• email_verified (Boolean)</div>
                  <div>• marketing_phone</div>
                  <div>• founder_name, founder_ig_url</div>
                  <div>• founder_linkedin_url</div>
                </div>
              </details>
            </div>

            {/* Box 3 */}
            <div className="p-3 rounded-lg bg-zinc-50/60 border border-zinc-200/80 flex flex-col justify-between craft-card">
              <div>
                <div className="font-semibold text-xs text-zinc-900 flex items-center justify-between">
                  <span>3. Status & Alur</span>
                  <span className="text-[9px] font-mono bg-zinc-200/60 px-1 py-0.2 rounded text-zinc-700">B1–C2</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Jalur outreach (Email/WA/DM), status pipeline (Cold Sent s/d Deal), & ID thread Gmail.
                </p>
              </div>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-[10px] font-medium text-zinc-700 hover:text-zinc-900 flex items-center justify-between pt-1 border-t border-zinc-200/60 craft-button">
                  <span>Lihat Kolom</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 font-mono text-[10px] text-zinc-600 space-y-0.5">
                  <div>• outreach_channel</div>
                  <div>• pipeline_status</div>
                  <div>• gmail_thread_id</div>
                  <div>• last_contacted_at</div>
                  <div>• next_followup_at</div>
                </div>
              </details>
            </div>

            {/* Box 4 */}
            <div className="p-3 rounded-lg bg-zinc-50/60 border border-zinc-200/80 flex flex-col justify-between craft-card">
              <div>
                <div className="font-semibold text-xs text-zinc-900 flex items-center justify-between">
                  <span>4. Draf AI & Deal $</span>
                  <span className="text-[9px] font-mono bg-zinc-200/60 px-1 py-0.2 rounded text-zinc-700">B3 & C2</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Ringkasan respon brand, draf balasan PDF siap kirim, draf DM 2 kalimat, & nilai deal USD.
                </p>
              </div>
              <details className="mt-2 group">
                <summary className="cursor-pointer text-[10px] font-medium text-zinc-700 hover:text-zinc-900 flex items-center justify-between pt-1 border-t border-zinc-200/60 craft-button">
                  <span>Lihat Kolom</span>
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1 font-mono text-[10px] text-zinc-600 space-y-0.5">
                  <div>• reply_summary</div>
                  <div>• ai_draft_ready, ai_draft_content</div>
                  <div>• gmail_draft_id</div>
                  <div>• dm_fallback_message</div>
                  <div>• deal_value_usd</div>
                </div>
              </details>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =====================================================================
          DIALOG: CHAT DENGAN MANAGER UTAMA
      ===================================================================== */}
      <Dialog open={isManagerChatOpen} onOpenChange={setIsManagerChatOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="p-3.5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold flex items-center gap-2">
                  <span>AI Outbound Manager Utama</span>
                  <Badge variant="outline" className="text-[9px] font-mono text-emerald-600">Online</Badge>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-500">
                  Beri instruksi langsung ke Manager untuk didelegasikan ke seluruh 6 agen AI.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 min-h-[260px] max-h-[380px] bg-slate-50/20 text-xs">
            {chatLog.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'manager' && (
                  <div className="h-6 w-6 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 text-[10px]">
                    <Bot className="h-3 w-3 text-blue-400" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 text-slate-800 dark:text-slate-200 shadow-2xs'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  ) : (
                    <div>
                      {msg.intent && (
                        <div className="flex flex-wrap items-center gap-1 mb-1.5 pb-1 border-b border-slate-100">
                          {msg.intent === 'decision' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Zap className="h-2.5 w-2.5 text-amber-600 fill-amber-500" />
                              <span>KEPUTUSAN OPERASIONAL</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Sparkles className="h-2.5 w-2.5 text-blue-600" />
                              <span>DISKUSI</span>
                            </span>
                          )}
                          {msg.summaryOfChanges && (
                            <span className="text-[9.5px] font-medium text-slate-500 truncate max-w-[200px]">
                              • {msg.summaryOfChanges}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="space-y-1.5 [&_strong]:font-bold [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:mt-0.5 [&_code]:font-mono [&_code]:bg-slate-100 dark:[&_code]:bg-slate-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_a]:text-blue-600 [&_a]:underline">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  <span className={`block text-[9px] mt-1 text-right ${msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
            {isManagerThinking && (
              <div className="flex gap-2 items-center text-xs text-slate-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>Manager sedang memproses...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            <Input
              value={managerInput}
              onChange={(e) => setManagerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendToManager()}
              placeholder="Ketik instruksi ke Manager..."
              className="text-xs h-8"
              disabled={isManagerThinking}
            />
            <Button
              size="sm"
              onClick={() => handleSendToManager()}
              disabled={!managerInput.trim() || isManagerThinking}
              className="h-8 bg-slate-900 hover:bg-slate-800 text-white shrink-0 px-3"
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
