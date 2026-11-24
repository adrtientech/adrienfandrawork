import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCrm } from '@/context/crm-context';
import {
  Bot,
  Send,
  RefreshCw,
  Search,
  PauseCircle,
  PlayCircle,
  Layers,
  ArrowRight,
  TrendingUp,
  Inbox,
  Clock,
  ExternalLink,
  ChevronRight,
  Zap,
  Globe2,
  ShieldCheck,
  Building2,
  Mail,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  AlertTriangle,
  FlaskConical,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn, formatCurrencyUSD, formatTimeAgo } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  sender: 'user' | 'manager';
  text: string;
  timestamp: string;
  intent?: 'discussion' | 'decision';
  summaryOfChanges?: string;
  directivesUpdated?: Record<string, any>;
}

const STORAGE_KEY_CHAT = 'creator_outbound_chat_history_v2';

export const MissionControlPage: React.FC = () => {
  const {
    brands,
    settings,
    refreshData,
    toggleGlobalPause,
    triggerAiDiscovery,
    triggerInboxCheck,
    waitingCount,
    negotiationAndDealCount,
    totalDealValueUsd,
    totalActionRequired,
  } = useCrm();

  // Chat state with persistent local storage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CHAT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'msg-welcome',
        sender: 'manager',
        text: `Halo Adrien! Saya **AI Outbound & Sponsorship Manager Utama** Anda.\n\nSaya memantau seluruh alur database CRM, status Gmail, Serper, kuota email, dan membawahi 6 staf AI (Tahap A1 s/d C2).\n\nAnda dapat berdiskusi dengan saya mengenai:\n- **Strategi & Evaluasi:** Diskusi target negara prioritas, niche brand, cara pitching yang efektif, dan evaluasi hasil balasan.\n- **Pengambilan Keputusan & Perintah:** Setiap kesepakatan atau perintah yang Anda berikan akan langsung saya terjemahkan menjadi aturan operasional untuk para staf AI (Atlas, Lyra, Aegis, Orion, Echo, Nova), sehingga alur kerja otomatis berubah tanpa Anda perlu menyentuh kode lagi.\n\nRiwayat diskusi kita kini tersimpan permanen. Ada yang ingin kita evaluasi atau putuskan hari ini?`,
        timestamp: 'Baru saja',
        intent: 'discussion',
      },
    ];
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCheckingInbox, setIsCheckingInbox] = useState(false);

  // Circuit Breaker Status
  const isCircuitBreakerTriggered = (settings.bounces_today || 0) > (settings.max_daily_bounces || 2);

  // A/B/C Testing Engine Performance
  const { variantStats, topVariant } = React.useMemo(() => {
    const variants = ['A', 'B', 'C'] as const;
    const stats: Record<'A' | 'B' | 'C', { sent: number; replies: number; deals: number; replyRate: number; dealRate: number }> = {
      A: { sent: 0, replies: 0, deals: 0, replyRate: 0, dealRate: 0 },
      B: { sent: 0, replies: 0, deals: 0, replyRate: 0, dealRate: 0 },
      C: { sent: 0, replies: 0, deals: 0, replyRate: 0, dealRate: 0 },
    };

    for (const b of brands) {
      const v = b.email_variant as 'A' | 'B' | 'C' | undefined;
      if (v && stats[v]) {
        const isSent = ['cold_sent', 'followup_1', 'followup_2', 'in_progress', 'deal', 'completed'].includes(b.pipeline_status);
        if (isSent) {
          stats[v].sent += 1;
          const hasReplied = Boolean(b.replied_at) || ['in_progress', 'deal', 'completed'].includes(b.pipeline_status);
          if (hasReplied) stats[v].replies += 1;
          if (b.pipeline_status === 'deal') stats[v].deals += 1;
        }
      }
    }

    for (const v of variants) {
      stats[v].replyRate = stats[v].sent > 0 ? Math.round((stats[v].replies / stats[v].sent) * 100) : 0;
      stats[v].dealRate = stats[v].sent > 0 ? Math.round((stats[v].deals / stats[v].sent) * 100) : 0;
    }

    let top: 'A' | 'B' | 'C' | null = null;
    let highestRate = -1;
    for (const v of variants) {
      if (stats[v].sent > 0 && stats[v].replyRate > highestRate) {
        highestRate = stats[v].replyRate;
        top = v;
      }
    }

    return { variantStats: stats, topVariant: top };
  }, [brands]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Sync with server persistent chat history on mount
  useEffect(() => {
    const fetchServerHistory = async () => {
      try {
        const res = await fetch('/api/manager/history');
        if (res.ok) {
          const data = await res.json();
          if (data.history && Array.isArray(data.history) && data.history.length > 0) {
            setMessages(data.history);
            try {
              localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(data.history));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Gagal memuat riwayat chat dari server:', err);
      }
    };
    fetchServerHistory();
  }, []);

  const saveMessages = (newMsgs: ChatMessage[]) => {
    setMessages(newMsgs);
    try {
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(newMsgs));
    } catch (e) {
      console.warn('Gagal simpan ke localStorage:', e);
    }
  };

  // Reset chat history to fresh session
  const handleClearHistory = async () => {
    if (!window.confirm('Mulai ulang percakapan dengan Manajer Utama? Riwayat chat sebelumnya akan direset dan dibuka lembaran baru.')) return;
    try {
      const res = await fetch('/api/manager/clear', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        saveMessages(data.history || []);
        toast.success('Chat dengan Manajer Utama berhasil di-restart!');
        return;
      }
    } catch (err) {
      console.warn('Gagal reset via API:', err);
    }
    const freshWelcome: ChatMessage = {
      id: 'msg-welcome',
      sender: 'manager',
      text: `Halo Adrien! Saya **AI Outbound & Sponsorship Manager Utama** Anda.\n\nSaya memantau seluruh alur database CRM, status Gmail, Serper, kuota email, dan membawahi 6 staf AI (Tahap A1 s/d C2).\n\nAnda dapat berdiskusi dengan saya mengenai:\n- **Strategi & Evaluasi:** Diskusi target negara prioritas, niche brand, cara pitching yang efektif, dan evaluasi hasil balasan.\n- **Pengambilan Keputusan & Perintah:** Setiap kesepakatan atau perintah yang Anda berikan akan langsung saya terjemahkan menjadi aturan operasional untuk para staf AI (Atlas, Lyra, Aegis, Orion, Echo, Nova), sehingga alur kerja otomatis berubah tanpa Anda perlu menyentuh kode lagi.\n\nRiwayat diskusi kita kini tersimpan permanen. Ada yang ingin kita evaluasi atau putuskan hari ini?`,
      timestamp: 'Baru saja',
      intent: 'discussion',
    };
    saveMessages([freshWelcome]);
    toast.success('Chat dengan Manajer Utama berhasil di-restart!');
  };

  // Handle Send Message to AI Manager
  const handleSendMessage = async (userText?: string) => {
    const textToSend = (userText || inputMessage).trim();
    if (!textToSend || isThinking) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMsgs = [...messages, userMsg];
    saveMessages(nextMsgs);
    setInputMessage('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          messages: messages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            content: m.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('Gagal menghubungi AI Manager.');
      }

      const data = await res.json();

      if (data.history && Array.isArray(data.history)) {
        saveMessages(data.history);
      } else {
        const managerReply: ChatMessage = {
          id: `mgr-${Date.now()}`,
          sender: 'manager',
          text: data.reply || 'Maaf, saya sedang memproses data terbaru.',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          intent: data.intent,
          summaryOfChanges: data.summaryOfChanges,
          directivesUpdated: data.directivesUpdated,
        };
        saveMessages([...nextMsgs, managerReply]);
      }

      // If a decision was made, inform user and refresh live settings
      if (data.intent === 'decision') {
        toast.success(
          data.summaryOfChanges || 'Keputusan operasional ditetapkan & disinkronkan ke seluruh staf AI!',
          { duration: 5000 }
        );
        await refreshData();
      }
    } catch (err: any) {
      console.error('Error saat menghubungi AI Manager:', err);
      const fallbackReply: ChatMessage = {
        id: `mgr-${Date.now()}`,
        sender: 'manager',
        text: `Maaf Adrien, koneksi ke otak AI Manager sedang terputus (${err.message || 'Network Timeout'}). Mohon pastikan \`GEMINI_API_KEY\` sudah dimasukkan ke Environment Variables Vercel agar saya bisa merespons percakapan ini secara langsung.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        intent: 'discussion',
      };
      saveMessages([...nextMsgs, fallbackReply]);
    } finally {
      setIsThinking(false);
    }
  };

  // Simulation actions
  const handleAiDiscovery = async () => {
    setIsDiscovering(true);
    try {
      await triggerAiDiscovery();
      // Notify manager
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'manager',
          text: `Saya baru saja menyelesaikan pencarian Google & analisis scoring AI untuk brand baru. Data telah diperbarui di database Supabase!`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleCheckInbox = async () => {
    setIsCheckingInbox(true);
    try {
      const res = await triggerInboxCheck();
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'manager',
          text: `Sinkronisasi Gmail selesai: ${res.message}. Semua status terbaru telah disinkronkan ke memori saya.`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsCheckingInbox(false);
    }
  };

  // Quick Action Chips
  const promptSuggestions = [
    '💡 Diskusi: Saran pitching untuk brand SaaS produktivitas?',
    '💡 Diskusi: Bagaimana aturan pengiriman PDF Media Kit di Vault?',
    '⚡ Keputusan: Prioritaskan target negara Singapura',
    '⚡ Keputusan: Kecualikan brand Binance dan 1xBet',
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-white text-zinc-900 font-sans">
      {/* Kolom Kiri: AI Manager Chat Interface */}
      <div className="flex-1 flex flex-col h-full border-r border-zinc-200/80 bg-white min-w-0">
        {/* Top Header */}
        <div className="px-5 py-3 border-b border-zinc-200/70 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-zinc-950 text-white flex items-center justify-center shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-[13px] tracking-tight text-zinc-900 leading-tight">
                  Outbound AI Manager
                </h1>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-none mt-0.5">
                Strategic Deal Maker & Otomasi Tim Karyawan AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/boardroom">
              <Button
                variant="outline"
                size="sm"
                title="Buka Ruang Rapat Tim & Evaluasi Lintas Jobdesk"
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-950 bg-emerald-50/70 hover:bg-emerald-100 border-emerald-200/90 h-7 px-2.5 gap-1.5 craft-button shadow-2xs"
              >
                <Users className="h-3 w-3 text-emerald-600" />
                <span>Ruang Rapat Tim</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              title="Mulai Ulang Percakapan dengan Manajer Utama"
              className="text-[11px] font-medium text-zinc-700 hover:text-zinc-950 bg-white hover:bg-zinc-100 border-zinc-200/90 h-7 px-2.5 gap-1.5 craft-button shadow-2xs"
            >
              <RotateCcw className="h-3 w-3 text-zinc-500" />
              <span>Restart Chat</span>
            </Button>

            <button
              onClick={toggleGlobalPause}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1 rounded-md border text-[11px] font-medium select-none craft-button",
                settings.is_global_paused
                  ? "bg-amber-50/60 border-amber-200 text-amber-800"
                  : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  settings.is_global_paused ? "bg-amber-500" : "bg-emerald-500"
                )}
              />
              <span>{settings.is_global_paused ? 'Engine Dijeda' : 'Engine Aktif'}</span>
            </button>
          </div>
        </div>

        {/* Circuit Breaker Emergency Banner */}
        {isCircuitBreakerTriggered && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 flex items-center justify-between text-xs text-rose-900 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                <strong>CIRCUIT BREAKER AKTIF:</strong> Terdeteksi <strong>{settings.bounces_today || 0} hard bounce</strong> hari ini (melebihi batas aman maks {settings.max_daily_bounces || 2}). Pengiriman otomatis dijeda demi reputasi email.
              </span>
            </div>
            <button
              onClick={toggleGlobalPause}
              className="text-[11px] font-semibold underline hover:text-rose-950 ml-4 shrink-0"
            >
              {settings.is_global_paused ? 'Buka Jeda (Resume)' : 'Jeda Sekarang'}
            </button>
          </div>
        )}

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-zinc-50/30">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-2xl ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {msg.sender === 'manager' && (
                <div className="h-6 w-6 rounded-md bg-zinc-950 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="h-3 w-3 text-zinc-200" />
                </div>
              )}

              <div
                className={`rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-zinc-950 text-white rounded-br-xs'
                    : 'bg-white border border-zinc-200/80 text-zinc-800 rounded-bl-xs'
                }`}
              >
                {msg.sender === 'user' ? (
                  <div className="whitespace-pre-wrap font-normal">
                    {msg.text}
                  </div>
                ) : (
                  <div>
                    {msg.intent && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-1.5 border-b border-zinc-100">
                        {msg.intent === 'decision' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-zinc-900 text-white tracking-tight">
                            <Zap className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                            <span>KEPUTUSAN OPERASIONAL AKTIF</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                            <Sparkles className="h-2.5 w-2.5 text-zinc-500" />
                            <span>DISKUSI STRATEGIS</span>
                          </span>
                        )}
                        {msg.summaryOfChanges && (
                          <span className="text-[10px] font-medium text-zinc-500">
                            • {msg.summaryOfChanges}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="space-y-2 [&_strong]:font-semibold [&_strong]:text-zinc-950 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:mt-0.5 [&_code]:font-mono [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.2 [&_code]:rounded [&_code]:text-[11px] [&_a]:text-zinc-900 [&_a]:underline">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                )}
                <div
                  className={`text-[9.5px] mt-1 tabular-nums ${
                    msg.sender === 'user' ? 'text-zinc-400 text-right' : 'text-zinc-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-2.5 max-w-md mr-auto">
              <div className="h-6 w-6 rounded-md bg-zinc-950 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="h-3 w-3 text-zinc-200" />
              </div>
              <div className="rounded-xl px-3 py-2 bg-white border border-zinc-200/80 text-[11.5px] text-zinc-500 rounded-bl-xs shadow-xs flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-900 animate-ping" />
                <span>Manager sedang menganalisis data pipeline...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2 border-t border-zinc-200/70 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[10.5px] font-medium text-zinc-400 shrink-0">Tanya Cepat:</span>
          {promptSuggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(sug)}
              disabled={isThinking}
              className="text-[10.5px] px-2 py-0.5 rounded-md bg-zinc-100/70 hover:bg-zinc-200/60 text-zinc-600 hover:text-zinc-900 whitespace-nowrap transition-colors border border-zinc-200/60 craft-button"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-zinc-200/70 bg-white shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleClearHistory}
              title="Restart Chat (Mulai Ulang Percakapan)"
              disabled={isThinking}
              className="h-9 w-9 shrink-0 text-zinc-500 hover:text-zinc-950 bg-white border-zinc-200/80 craft-button shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Diskusikan strategi pitching atau berikan keputusan operasional..."
              disabled={isThinking}
              className="h-9 text-[12.5px] bg-zinc-50/70 border-zinc-200/80 focus-visible:ring-1 focus-visible:ring-zinc-900 text-zinc-900 placeholder:text-zinc-400"
            />
            <Button
              type="submit"
              disabled={isThinking || !inputMessage.trim()}
              className="h-9 px-3.5 bg-zinc-950 hover:bg-zinc-900 text-white gap-1.5 shadow-xs craft-button"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs font-medium">Kirim</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Kolom Kanan: High-Craft Live Operations Widget (Emil Kowalski Standards) */}
      <div className="w-full lg:w-72 shrink-0 border-l border-zinc-200/80 bg-zinc-50/40 p-4 overflow-y-auto space-y-3.5 select-none">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Live Operations Control
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Kontrol mesin otomatisasi pipeline
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={handleAiDiscovery}
            disabled={isDiscovering}
            className="h-8 px-2.5 rounded-md text-[11px] font-medium bg-white border border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 flex items-center justify-start gap-1.5 shadow-2xs craft-button"
          >
            <Search className={`h-3 w-3 text-zinc-500 ${isDiscovering ? 'animate-spin' : ''}`} />
            <span>{isDiscovering ? 'Mencari...' : 'Riset AI'}</span>
          </button>

          <button
            onClick={handleCheckInbox}
            disabled={isCheckingInbox}
            className="h-8 px-2.5 rounded-md text-[11px] font-medium bg-white border border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-800 flex items-center justify-start gap-1.5 shadow-2xs craft-button"
          >
            <RefreshCw className={`h-3 w-3 text-zinc-500 ${isCheckingInbox ? 'animate-spin' : ''}`} />
            <span>{isCheckingInbox ? 'Cek...' : 'Cek Inbox'}</span>
          </button>
        </div>

        {/* Unified Minimal Metrics Stack (Craft UI) */}
        <div className="rounded-lg border border-zinc-200/80 bg-white p-3 divide-y divide-zinc-100 shadow-2xs">
          <div className="pb-2.5 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-zinc-500">Total Brand</span>
            <span className="text-base font-semibold tabular-nums text-zinc-900">{brands.length}</span>
          </div>

          <div className="py-2.5 flex items-baseline justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span className="text-[11px] font-medium text-zinc-600">Perlu Tindakan</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-zinc-900">{totalActionRequired}</span>
          </div>

          <div className="py-2.5 flex items-baseline justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-[11px] font-medium text-zinc-600">Menunggu Balasan</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-zinc-900">{waitingCount}</span>
          </div>

          <div className="pt-2.5 flex items-baseline justify-between">
            <span className="text-[11px] font-medium text-zinc-500">Estimasi Deal</span>
            <span className="text-sm font-semibold tabular-nums text-emerald-700">
              {formatCurrencyUSD(totalDealValueUsd)}
            </span>
          </div>
        </div>

        {/* A/B/C Testing Performance Card (Emil Kowalski Craft UI) */}
        <div className="rounded-lg border border-zinc-200/80 bg-white p-3 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-[11px] font-semibold text-zinc-900">
                A/B/C Testing
              </span>
            </div>
            {topVariant && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono">
                Top: {topVariant}
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            {(['A', 'B', 'C'] as const).map((vKey) => {
              const data = variantStats[vKey];
              const isTop = topVariant === vKey && data.sent > 0;
              return (
                <div
                  key={vKey}
                  className={cn(
                    "p-2 rounded-md border text-[11px] transition-colors",
                    isTop
                      ? "bg-violet-50/40 border-violet-200/80"
                      : "bg-zinc-50/60 border-zinc-200/60"
                  )}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
                      <span className={cn(
                        "h-4 w-4 rounded flex items-center justify-center text-[10px] font-bold font-mono",
                        vKey === 'A' ? "bg-blue-100 text-blue-800" :
                        vKey === 'B' ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      )}>
                        {vKey}
                      </span>
                      <span className="text-[10.5px]">
                        {vKey === 'A' && 'R.O.P.E.'}
                        {vKey === 'B' && 'Boss Redirect'}
                        {vKey === 'C' && 'Gap Angle'}
                      </span>
                    </span>
                    <span className="font-mono text-zinc-900 font-semibold tabular-nums">
                      {data.replyRate}% <span className="text-[9.5px] text-zinc-400 font-normal">reply</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1 text-[9.5px] text-zinc-500 font-mono">
                    <span>Kirim: {data.sent}</span>
                    <span>Balas: {data.replies}</span>
                    <span className="text-emerald-700 font-medium">Deal: {data.deals} ({data.dealRate}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Backend Live Integration Card */}
        <div className="rounded-lg border border-zinc-200/80 bg-white p-3 space-y-2 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-800">
            Integrasi Backend Aktif
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-zinc-600">
              <span>PostgreSQL Supabase</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-700 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-600">
              <span>Google Gemini 2.5</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-700 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-600">
              <span>Serper.dev Search</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-700 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-600">
              <span>Gmail API OAuth2</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-700 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            </div>
          </div>
        </div>

        {/* Quick Link to Pipeline */}
        <Link
          to="/pipeline"
          className="flex items-center justify-between px-3 py-2.5 rounded-md bg-white border border-zinc-200/80 hover:border-zinc-300 text-zinc-800 text-[11.5px] font-medium shadow-2xs craft-button group"
        >
          <span>Buka Tabel Pipeline</span>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
};
