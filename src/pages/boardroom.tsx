import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Users,
  Play,
  Pause,
  RotateCcw,
  Send,
  Hand,
  Bot,
  Compass,
  Sparkles,
  ShieldCheck,
  Mail,
  Inbox,
  Zap,
  Crown,
  CornerDownRight,
  Copy,
  Check,
  MessageSquare,
  Flame,
  VolumeX,
  Volume2,
  SlidersHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCrm } from '@/context/crm-context';
import { toast } from 'sonner';

export type ParticipantId = 'boss' | 'manager' | 'atlas' | 'lyra' | 'aegis' | 'orion' | 'echo' | 'nova';

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

const STORAGE_KEY = 'creator_crm_boardroom_v1';

const PRESET_AGENDAS = [
  '📊 Evaluasi Kinerja Mingguan (Semua Staf Lapor & Evaluasi)',
  '🎯 Strategi Niche & Penetrasi Brand Global (Atlas vs Lyra)',
  '📨 Optimasi Cold Email ROPE & Deliverability (Aegis vs Orion)',
  '💰 Negosiasi Rate Card & Penawaran Paket Sponsor (Manager vs Echo)',
  '🔄 Retensi & Penyelamatan DM Founder (Echo vs Nova)',
];

const ROSTER_META: Record<
  ParticipantId,
  {
    name: string;
    role: string;
    stage: string;
    color: string;
    icon: React.ElementType;
    bgClass: string;
    borderClass: string;
    textClass: string;
    badgeClass: string;
  }
> = {
  boss: {
    name: 'Adrien Fandra',
    role: 'Founder & CEO (The Boss)',
    stage: 'Kekuasaan Tertinggi',
    color: 'indigo',
    icon: Crown,
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    badgeClass: 'bg-indigo-600 text-white',
  },
  manager: {
    name: 'Manager Utama',
    role: 'Chief of Staff & Deal Director',
    stage: 'Moderator Rapat',
    color: 'emerald',
    icon: Bot,
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    badgeClass: 'bg-emerald-600 text-white',
  },
  atlas: {
    name: 'Atlas',
    role: 'Discovery Specialist',
    stage: 'Tahap A1',
    color: 'sky',
    icon: Compass,
    bgClass: 'bg-sky-50 dark:bg-sky-950/40',
    borderClass: 'border-sky-200 dark:border-sky-800',
    textClass: 'text-sky-700 dark:text-sky-300',
    badgeClass: 'bg-sky-600 text-white',
  },
  lyra: {
    name: 'Lyra',
    role: 'Enrichment & Lead Scoring',
    stage: 'Tahap A2-A3',
    color: 'purple',
    icon: Sparkles,
    bgClass: 'bg-purple-50 dark:bg-purple-950/40',
    borderClass: 'border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-700 dark:text-purple-300',
    badgeClass: 'bg-purple-600 text-white',
  },
  aegis: {
    name: 'Aegis',
    role: 'Verifier & Bounce Shield',
    stage: 'Tahap A4',
    color: 'teal',
    icon: ShieldCheck,
    bgClass: 'bg-teal-50 dark:bg-teal-950/40',
    borderClass: 'border-teal-200 dark:border-teal-800',
    textClass: 'text-teal-700 dark:text-teal-300',
    badgeClass: 'bg-teal-600 text-white',
  },
  orion: {
    name: 'Orion',
    role: 'Outreach & Timezone Director',
    stage: 'Tahap B1-B2',
    color: 'amber',
    icon: Mail,
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
    borderClass: 'border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-700 dark:text-amber-300',
    badgeClass: 'bg-amber-600 text-white',
  },
  echo: {
    name: 'Echo',
    role: 'Inbox Watcher & Closer',
    stage: 'Tahap B3',
    color: 'rose',
    icon: Inbox,
    bgClass: 'bg-rose-50 dark:bg-rose-950/40',
    borderClass: 'border-rose-200 dark:border-rose-800',
    textClass: 'text-rose-700 dark:text-rose-300',
    badgeClass: 'bg-rose-600 text-white',
  },
  nova: {
    name: 'Nova',
    role: 'Follow-up & Multichannel Strategist',
    stage: 'Tahap C1-C2',
    color: 'violet',
    icon: Zap,
    bgClass: 'bg-violet-50 dark:bg-violet-950/40',
    borderClass: 'border-violet-200 dark:border-violet-800',
    textClass: 'text-violet-700 dark:text-violet-300',
    badgeClass: 'bg-violet-600 text-white',
  },
};

export const BoardroomPage: React.FC = () => {
  const { brands, settings } = useCrm();

  const [agenda, setAgenda] = useState<string>(PRESET_AGENDAS[0]);
  const [messages, setMessages] = useState<BoardroomMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeSpeaker, setActiveSpeaker] = useState<ParticipantId | null>(null);
  const [bossInput, setBossInput] = useState<string>('');
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [showRosterMobile, setShowRosterMobile] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAutoPlayingRef = useRef<boolean>(isAutoPlaying);
  isAutoPlayingRef.current = isAutoPlaying;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeSpeaker]);

  // Save to LocalStorage
  const saveMessages = useCallback((newMsgs: BoardroomMessage[]) => {
    setMessages(newMsgs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMsgs));
    } catch (e) {
      console.warn('Gagal menyimpan riwayat boardroom ke storage:', e);
    }
  }, []);

  // Request next dialogue turn from API
  const requestDialogueTurn = useCallback(
    async (params: {
      action?: 'start' | 'next' | 'boss_interrupt';
      userText?: string;
      targetSpeaker?: ParticipantId;
    }) => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        const res = await fetch('/api/boardroom/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agenda,
            history: messages,
            bossInput: params.userText,
            requestedSpeaker: params.targetSpeaker,
            action: params.action || (params.userText ? 'boss_interrupt' : 'next'),
          }),
        });

        if (!res.ok) {
          throw new Error('Gagal memproses giliran rapat.');
        }

        const data = await res.json();
        if (data.success && data.message) {
          setActiveSpeaker(data.message.speakerId);
          saveMessages([...messages, data.message]);

          // Small delay for natural conversation feel
          setTimeout(() => {
            setActiveSpeaker(null);
          }, 1200);
        }
      } catch (err: any) {
        console.error('[Boardroom Error]:', err);
        toast.error(err.message || 'Koneksi ke Ruang Rapat terganggu.');
        setIsAutoPlaying(false);
      } finally {
        setIsProcessing(false);
      }
    },
    [agenda, messages, isProcessing, saveMessages]
  );

  // Auto-play loop: AI employees discuss among themselves automatically
  useEffect(() => {
    if (!isAutoPlaying) return;

    const timer = setInterval(() => {
      if (isAutoPlayingRef.current && !isProcessing) {
        requestDialogueTurn({ action: 'next' });
      }
    }, 4500);

    return () => clearInterval(timer);
  }, [isAutoPlaying, isProcessing, requestDialogueTurn]);

  // Start fresh meeting
  const handleStartMeeting = async () => {
    setIsAutoPlaying(false);
    saveMessages([]);
    toast.info('Memulai rapat baru... Moderator Manager Utama sedang membuka agenda.');
    await requestDialogueTurn({ action: 'start' });
    setIsAutoPlaying(true);
  };

  // Boss sends command/input
  const handleSendBossMessage = async (customText?: string) => {
    const textToSend = (customText || bossInput).trim();
    if (!textToSend || isProcessing) return;

    // Immediately pause auto-discussion: Boss is speaking!
    setIsAutoPlaying(false);

    const bossMsg: BoardroomMessage = {
      id: `boss-${Date.now()}`,
      speakerId: 'boss',
      speakerName: 'Adrien Fandra (BOS)',
      speakerRole: 'Founder & CEO',
      avatarColor: 'indigo',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      type: 'directive',
    };

    const nextList = [...messages, bossMsg];
    saveMessages(nextList);
    setBossInput('');

    // Trigger AI response to Boss
    await requestDialogueTurn({ action: 'boss_interrupt', userText: textToSend });
  };

  // Boss commands: Silence / Pause
  const handleBossSilence = () => {
    setIsAutoPlaying(false);
    toast.warning('✋ Rapat dijeda! Semua staf AI hening mendengarkan Bos Adrien.');
  };

  // Copy transcript
  const handleCopyTranscript = () => {
    if (messages.length === 0) return;
    const text = messages
      .map((m) => `[${m.timestamp}] ${m.speakerName} (${m.speakerRole}):\n${m.content}\n`)
      .join('\n---\n\n');
    navigator.clipboard.writeText(`NOTULEN RAPAT EKSEKUTIF - AGENDA: ${agenda}\n\n` + text);
    setCopiedTranscript(true);
    toast.success('Notulen rapat berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Quick Boss Prompt Chips
  const quickBossChips = [
    '✋ Tahan dulu semua, saya mau evaluasi poin ini.',
    'Atlas, kenapa minggu ini brand devtools masih sedikit?',
    'Lyra, standar skor kelayakan kita masih terlalu ketat gak?',
    'Orion, coba tunjukkan perbandingan performa ROPE vs Boss Redirect!',
    'Echo, ada brand yang siap closing atau minta negosiasi rate card hari ini?',
    'Bagus tim! Lanjutkan diskusi kalian, saya pantau.',
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* =====================================================================
          KOLOM UTAMA: ARENA RUANG RAPAT (GROUP CHAT STREAM)
      ===================================================================== */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800 min-w-0">
        {/* Top Header Bar */}
        <div className="px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  Ruang Rapat Eksekutif Tim AI
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-mono font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 transition-colors',
                    isAutoPlaying
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      isAutoPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    )}
                  />
                  <span>{isAutoPlaying ? 'Rapat Aktif (Auto-Debate)' : 'Hening (Mendengarkan Bos)'}</span>
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                Evaluasi Kinerja Silang Jobdesk & Kolaborasi Strategis 6 Agen AI
              </p>
            </div>
          </div>

          {/* Action Buttons Top */}
          <div className="flex items-center gap-2 shrink-0">
            {isAutoPlaying ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBossSilence}
                className="h-8 text-xs font-medium text-amber-700 bg-amber-50/70 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 gap-1.5"
                title="Hentikan sementara agar Bos bisa bicara"
              >
                <Hand className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">✋ Hentikan Rapat</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAutoPlaying(true)}
                className="h-8 text-xs font-medium text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 gap-1.5"
                title="Lanjutkan dialog otomatis antar staf AI"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">▶️ Lanjutkan Rapat</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleStartMeeting}
              className="h-8 text-xs font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 gap-1.5"
              title="Mulai rapat dari awal"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Mulai Rapat Baru</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTranscript}
              className="h-8 text-xs font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 gap-1.5"
              title="Salin transkrip dialog rapat"
            >
              {copiedTranscript ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
              <span className="hidden sm:inline">Salin Notulen</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRosterMobile(!showRosterMobile)}
              className="h-8 px-2 text-zinc-500 lg:hidden"
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Agenda Bar */}
        <div className="px-5 py-2.5 bg-zinc-50/80 dark:bg-zinc-950/60 border-b border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] shrink-0">
              📌 Agenda:
            </span>
            <select
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-md px-2.5 py-1 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-zinc-400 truncate max-w-md sm:max-w-xl"
            >
              {PRESET_AGENDAS.map((a, i) => (
                <option key={i} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-[11px] shrink-0">
            <span>Live Data CRM:</span>
            <Badge variant="secondary" className="font-mono text-[10px] h-5">
              {brands.length} Brands
            </Badge>
          </div>
        </div>

        {/* Message Stream Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 bg-zinc-50/30 dark:bg-zinc-950/20">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6">
              <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-4 shadow-inner">
                <Users className="h-7 w-7 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 mb-1">
                Ruang Rapat Siap Dimulai
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                Seluruh 6 staf AI (Atlas, Lyra, Aegis, Orion, Echo, Nova) dan Manager Utama sudah hadir di meja rapat.
                Klik tombol di bawah untuk membuka rapat evaluasi kinerja.
              </p>
              <Button
                onClick={handleStartMeeting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs font-medium text-xs px-5 h-9 flex items-center gap-2"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Buka Rapat Evaluasi Sekarang</span>
              </Button>
            </div>
          ) : (
            messages.map((msg) => {
              const meta = ROSTER_META[msg.speakerId] || ROSTER_META.manager;
              const IconComp = meta.icon;
              const isBoss = msg.speakerId === 'boss';

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-3 group transition-all',
                    isBoss ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Avatar */}
                  <div className="shrink-0 mt-0.5">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shadow-xs',
                        isBoss
                          ? 'bg-indigo-600 text-white'
                          : meta.bgClass + ' ' + meta.borderClass + ' border ' + meta.textClass
                      )}
                    >
                      <IconComp className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Bubble Content */}
                  <div
                    className={cn(
                      'max-w-2xl rounded-2xl p-4 shadow-2xs border transition-all text-xs sm:text-[13px] leading-relaxed',
                      isBoss
                        ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-xs'
                        : 'bg-white dark:bg-zinc-800/90 text-zinc-800 dark:text-zinc-200 border-zinc-200/80 dark:border-zinc-700/80 rounded-tl-xs'
                    )}
                  >
                    {/* Header: Name, Role & Replying Tag */}
                    <div
                      className={cn(
                        'flex items-center gap-2 mb-1.5 pb-1.5 border-b',
                        isBoss
                          ? 'border-indigo-500/50 justify-end'
                          : 'border-zinc-100 dark:border-zinc-700/60 justify-between'
                      )}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            'font-semibold text-xs',
                            isBoss ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
                          )}
                        >
                          {msg.speakerName}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.2 rounded font-mono',
                            isBoss
                              ? 'bg-indigo-700 text-indigo-100'
                              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300'
                          )}
                        >
                          {msg.speakerRole}
                        </span>

                        {msg.replyingToName && (
                          <span
                            className={cn(
                              'text-[10px] flex items-center gap-0.5',
                              isBoss ? 'text-indigo-200' : 'text-zinc-400'
                            )}
                          >
                            <CornerDownRight className="h-2.5 w-2.5" />
                            menanggapi {msg.replyingToName}
                          </span>
                        )}
                      </div>

                      <span
                        className={cn(
                          'text-[10px] font-mono shrink-0',
                          isBoss ? 'text-indigo-200' : 'text-zinc-400 dark:text-zinc-500'
                        )}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Markdown Body */}
                    <div
                      className={cn(
                        'prose prose-xs max-w-none dark:prose-invert',
                        isBoss && 'text-white prose-p:text-white prose-strong:text-white prose-headings:text-white'
                      )}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {isProcessing && (
            <div className="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500 italic p-2">
              <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center animate-spin">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <span>Tim sedang menyusun tanggapan & data evaluasi...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips for Boss */}
        <div className="px-4 py-2 border-t border-zinc-200/60 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Crown className="h-3 w-3 text-indigo-500" /> Arahan Cepat:
          </span>
          {quickBossChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendBossMessage(chip)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shrink-0 transition-colors craft-button"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Boss Input Bar */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={bossInput}
                onChange={(e) => setBossInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendBossMessage();
                  }
                }}
                placeholder="Beri instruksi, evaluasi, kritik, atau ajukan pertanyaan ke tim (Posisi Anda: Bos)..."
                className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-xs sm:text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-2xs"
              />
            </div>

            <Button
              onClick={() => handleSendBossMessage()}
              disabled={!bossInput.trim() || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-10 px-4 text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Instruksi Bos</span>
            </Button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Hand className="h-3 w-3 text-amber-500" />
              <span>
                Ketika Anda mengetik / chat, <b>seluruh AI otomatis hening</b> dan membiarkan Anda berbicara.
              </span>
            </span>
            <span className="hidden sm:inline">Tekan Enter untuk mengirim</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          KOLOM KANAN: DAFTAR HADIR PESERTA RAPAT (ROSTER PANEL)
      ===================================================================== */}
      <div
        className={cn(
          'w-full lg:w-72 xl:w-80 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/60 flex flex-col h-full border-t lg:border-t-0 lg:border-l border-zinc-200/80 dark:border-zinc-800 select-none',
          showRosterMobile ? 'block' : 'hidden lg:flex'
        )}
      >
        <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            <h2 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Peserta Meja Rapat (8)
            </h2>
          </div>
          <Badge variant="outline" className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            Lengkap
          </Badge>
        </div>

        {/* Participant Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(Object.keys(ROSTER_META) as ParticipantId[]).map((pid) => {
            const meta = ROSTER_META[pid];
            const IconComp = meta.icon;
            const isSpeaking = activeSpeaker === pid;

            return (
              <div
                key={pid}
                className={cn(
                  'p-3 rounded-xl border transition-all text-xs relative overflow-hidden',
                  isSpeaking
                    ? 'bg-white dark:bg-zinc-800 border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white/80 dark:bg-zinc-900/80 hover:bg-white dark:hover:bg-zinc-800 border-zinc-200/70 dark:border-zinc-800 shadow-2xs'
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5',
                      meta.bgClass,
                      meta.borderClass,
                      meta.textClass
                    )}
                  >
                    <IconComp className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {meta.name}
                      </span>
                      <span className={cn('text-[9px] font-mono font-medium px-1.5 py-0.2 rounded', meta.badgeClass)}>
                        {meta.stage}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {meta.role}
                    </p>

                    {/* Status live */}
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      {isSpeaking ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                          Sedang Berbicara...
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-500">Mendengarkan</span>
                      )}

                      {pid !== 'boss' && (
                        <button
                          onClick={() => {
                            toast.info(`Menunjuk ${meta.name} untuk memberikan tanggapan...`);
                            requestDialogueTurn({ targetSpeaker: pid, action: 'next' });
                          }}
                          className="text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
                          title={`Tunjuk ${meta.name} untuk berbicara`}
                        >
                          Tunjuk Bicara →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Meeting Tips */}
        <div className="p-3 bg-zinc-100/70 dark:bg-zinc-900/50 border-t border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
            <Info className="h-3.5 w-3.5 text-indigo-500" />
            <span>Hak Veto Bos:</span>
          </div>
          <p className="text-[10px] leading-relaxed">
            Karyawan AI berdialog secara otonom. Anda bebas menyela, mengkritik performa metrik, atau mengubah arah rapat kapan saja.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BoardroomPage;
