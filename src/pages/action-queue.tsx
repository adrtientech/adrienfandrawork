import React, { useState } from 'react';
import { useCrm } from '@/context/crm-context';
import { Brand } from '@/types/brand';
import { BrandService } from '@/lib/brand-service';
import {
  Inbox,
  Mail,
  Copy,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Phone,
  MessageSquare,
  Instagram,
  Linkedin,
  Bot,
  Lightbulb,
  DollarSign,
  Send,
  AlertCircle,
  Sparkles,
  Loader2,
  Share2
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export const ActionQueuePage: React.FC = () => {
  const { replyQueue, manualPhoneQueue, fallbackDmQueue, brands, updateBrand } = useCrm();

  // State for editable AI drafts in Tab 1
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

  // State for LinkedIn Outreach (Tab 3)
  const [linkedinTabFilter, setLinkedinTabFilter] = useState<'fallback' | 'all'>('fallback');
  const [linkedinFormat, setLinkedinFormat] = useState<Record<string, 'connection_note' | 'inmail_pitch'>>({});
  const [linkedinDrafts, setLinkedinDrafts] = useState<Record<string, { connectionNote?: string; inmailPitch?: string }>>({});
  const [isGeneratingLinkedIn, setIsGeneratingLinkedIn] = useState<Record<string, boolean>>({});

  // Brands with LinkedIn profiles
  const brandsWithLinkedIn = (brands || []).filter((b) => b.founder_linkedin_url || b.company_linkedin_url);
  const displayedLinkedInQueue = linkedinTabFilter === 'fallback' ? fallbackDmQueue : brandsWithLinkedIn;

  // State for Deal Modal
  const [dealModalBrand, setDealModalBrand] = useState<Brand | null>(null);
  const [dealValueInput, setDealValueInput] = useState('');

  // Handle draft text change
  const handleDraftChange = (brandId: string, text: string) => {
    setDraftEdits((prev) => ({ ...prev, [brandId]: text }));
  };

  // Copy text helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} berhasil disalin ke clipboard!`);
  };

  // Action: Salin & Simpan Draf
  const handleSaveAndCopyDraft = async (brand: Brand) => {
    const currentDraft = draftEdits[brand.id] !== undefined ? draftEdits[brand.id] : (brand.ai_draft_content || '');
    if (draftEdits[brand.id] !== undefined) {
      await updateBrand(brand.id, { ai_draft_content: currentDraft });
    }
    copyToClipboard(currentDraft, 'Draf balasan AI');
  };

  // Action: Tandai Deal (buka modal)
  const openDealModal = (brand: Brand) => {
    setDealModalBrand(brand);
    setDealValueInput(brand.deal_value_usd ? String(brand.deal_value_usd) : '3000');
  };

  const confirmDeal = async () => {
    if (!dealModalBrand) return;
    const value = dealValueInput.trim() ? parseFloat(dealValueInput) : null;
    await updateBrand(dealModalBrand.id, {
      pipeline_status: 'deal',
      deal_value_usd: value,
    });
    toast.success(`Kesepakatan dengan ${dealModalBrand.company_name} berhasil ditandai sebagai DEAL! 🎉`);
    setDealModalBrand(null);
  };

  // Action: Tandai Batal
  const handleMarkCancelled = async (brand: Brand) => {
    await updateBrand(brand.id, { pipeline_status: 'cancelled' });
    toast.info(`${brand.company_name} ditandai sebagai Batal / Menolak.`);
  };

  // Action: Sudah Saya Hubungi (Tab 2)
  const handleMarkContactedWA = async (brand: Brand) => {
    await updateBrand(brand.id, {
      pipeline_status: 'in_progress',
      last_contacted_at: new Date().toISOString(),
      notes: `${brand.notes ? brand.notes + ' | ' : ''}Sudah dihubungi manual via WhatsApp.`,
    });
    toast.success(`${brand.company_name} dipindahkan ke Balasan Masuk (In Progress).`);
  };

  // Action: Tandai DM Terkirim (Tab 3)
  const handleMarkDmSent = async (brand: Brand) => {
    await updateBrand(brand.id, {
      pipeline_status: 'in_progress',
      last_contacted_at: new Date().toISOString(),
      notes: `${brand.notes ? brand.notes + ' | ' : ''}Pesan DM Founder terkirim di media sosial.`,
    });
    toast.success(`DM untuk ${brand.founder_name || brand.company_name} ditandai terkirim!`);
  };

  // Action: Generate LinkedIn Pitch via Nova AI
  const handleGenerateLinkedInPitch = async (brand: Brand) => {
    setIsGeneratingLinkedIn((prev) => ({ ...prev, [brand.id]: true }));
    try {
      const res = await BrandService.generateLinkedInPitch({
        brandId: brand.id,
        companyName: brand.company_name,
        domain: brand.domain,
        productSummary: brand.product_summary || undefined,
        founderName: brand.founder_name || undefined,
        primaryPicName: brand.primary_pic_name || undefined,
        primaryPicRole: brand.primary_pic_role || undefined,
        founderLinkedinUrl: brand.founder_linkedin_url || undefined,
        companyLinkedinUrl: brand.company_linkedin_url || undefined,
        nicheCategory: brand.niche_category || undefined,
        country: brand.country || undefined,
      });

      setLinkedinDrafts((prev) => ({
        ...prev,
        [brand.id]: {
          connectionNote: res.connectionNote,
          inmailPitch: res.inmailPitch,
        },
      }));
      toast.success(`Draf LinkedIn untuk ${brand.founder_name || brand.company_name} berhasil dibuat oleh Nova!`);
    } catch (e: any) {
      toast.error('Gagal membuat draf LinkedIn: ' + (e?.message || 'Error'));
    } finally {
      setIsGeneratingLinkedIn((prev) => ({ ...prev, [brand.id]: false }));
    }
  };

  // Action: Buka Profil & Salin Pesan LinkedIn
  const handleOpenAndCopyLinkedIn = (brand: Brand, textToCopy: string, targetUrl: string) => {
    navigator.clipboard.writeText(textToCopy);
    toast.success('Pesan LinkedIn disalin ke clipboard! Membuka profil LinkedIn target...');
    window.open(targetUrl || 'https://linkedin.com', '_blank');
  };

  // Action: Tandai Terhubung via LinkedIn
  const handleMarkLinkedInSent = async (brand: Brand) => {
    await updateBrand(brand.id, {
      pipeline_status: 'in_progress',
      outreach_channel: 'dm_founder',
      last_contacted_at: new Date().toISOString(),
      notes: `${brand.notes ? brand.notes + ' | ' : ''}[LINKEDIN OUTREACH] Terhubung via LinkedIn (${new Date().toLocaleDateString('id-ID')}).`,
    });
    toast.success(`LinkedIn Outreach untuk ${brand.founder_name || brand.company_name} ditandai aktif!`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border/80">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Action Queue
          </h1>
          <Badge variant="destructive" className="font-mono text-xs font-bold">
            {replyQueue.length + manualPhoneQueue.length + fallbackDmQueue.length} Perlu Tindakan
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Daftar tugas harian yang memerlukan sentuhan langsung kreator untuk mengonversi prospek menjadi sponsorship.
        </p>
      </div>

      {/* 3 Tabs */}
      <Tabs defaultValue="replies" className="space-y-4">
        <TabsList className="bg-muted/70 p-1 rounded-xl grid grid-cols-3 max-w-xl">
          <TabsTrigger value="replies" className="text-xs gap-2 py-2">
            <span>Balasan Masuk</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/20 text-primary">
              {replyQueue.length}
            </span>
          </TabsTrigger>

          <TabsTrigger value="manual" className="text-xs gap-2 py-2">
            <span>Kontak Marketing</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">
              {manualPhoneQueue.length}
            </span>
          </TabsTrigger>

          <TabsTrigger value="fallback" className="text-xs gap-2 py-2">
            <Linkedin className="h-3.5 w-3.5 text-blue-500" />
            <span>LinkedIn & DM Founder</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-500">
              {fallbackDmQueue.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Balasan Masuk */}
        <TabsContent value="replies" className="space-y-4">
          {replyQueue.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Semua Balasan Masuk Telah Ditangani!</p>
              <p className="text-xs">Klik tombol &quot;Cek Inbox&quot; di Mission Control untuk menyinkronkan balasan terbaru dari Gmail.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {replyQueue.map((brand) => {
                const currentDraft =
                  draftEdits[brand.id] !== undefined
                    ? draftEdits[brand.id]
                    : brand.ai_draft_content || '';

                return (
                  <Card key={brand.id} className="border-border/80 shadow-sm overflow-hidden">
                    <CardHeader className="p-4 pb-3 bg-muted/20 border-b border-border/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-sm font-bold">
                                {brand.company_name}
                              </CardTitle>
                              <Badge variant="outline" className="text-[10px]">
                                {brand.country}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {brand.niche_category}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              PIC: {brand.primary_pic_name || 'N/A'} ({brand.primary_email})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              window.open(
                                `https://mail.google.com/mail/u/0/#inbox/${brand.gmail_thread_id || ''}`,
                                '_blank'
                              );
                            }}
                            className="h-8 text-xs gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Buka di Gmail</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                      {/* Highlight Reply Summary */}
                      <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs">
                        <span className="font-bold text-indigo-400 block mb-1">
                          💬 Ringkasan Balasan Masuk (AI Extract):
                        </span>
                        <p className="text-foreground leading-relaxed">
                          {brand.reply_summary || 'Brand tertarik untuk berdiskusi lebih lanjut mengenai paket kerjasama sponsorship.'}
                        </p>
                      </div>

                      {/* Editable AI Draft Content */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5 text-blue-600" />
                            Draf Balasan Negosiasi Otomatis (R.O.P.E. & Tier Bundle):
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            *Dapat diedit langsung sebelum dikirim
                          </span>
                        </div>
                        <Textarea
                          rows={4}
                          value={currentDraft}
                          onChange={(e) => handleDraftChange(brand.id, e.target.value)}
                          className="font-mono text-xs leading-relaxed bg-background/80"
                        />
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-0 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSaveAndCopyDraft(brand)}
                          className="h-8 text-xs gap-1.5 font-semibold"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin Draf</span>
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkCancelled(brand)}
                          className="h-8 text-xs text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          <span>Tandai Batal</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => openDealModal(brand)}
                          className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>Tandai Deal</span>
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Kontak Marketing Langsung */}
        <TabsContent value="manual" className="space-y-4">
          {manualPhoneQueue.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Tidak Ada Antrean Kontak Marketing Manual</p>
              <p className="text-xs">Brand dengan nomor WA / telepon akan otomatis dialihkan ke tab ini.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {manualPhoneQueue.map((brand) => (
                <Card key={brand.id} className="border-border/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            {brand.company_name}
                            <Badge variant="outline" className="text-[10px]">
                              {brand.country}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {brand.domain}
                          </p>
                        </div>
                        <Badge variant="purple" className="text-[10px]">
                          Ditahan AI (Ada No WA)
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3 text-xs">
                      {/* Phone Display */}
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-mono text-emerald-400 font-bold">
                          <Phone className="h-4 w-4" />
                          <span>{brand.marketing_phone || 'N/A'}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(brand.marketing_phone || '', 'Nomor Telepon')}
                          className="h-7 text-[11px] px-2 text-emerald-400 hover:text-emerald-300"
                        >
                          Salin
                        </Button>
                      </div>

                      {/* Product Summary */}
                      <div>
                        <span className="font-semibold text-foreground block mb-0.5">Produk:</span>
                        <p className="text-muted-foreground">{brand.product_summary}</p>
                      </div>

                      {/* Suggested Content Idea */}
                      {brand.suggested_content_ideas && brand.suggested_content_ideas.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60">
                          <span className="font-semibold text-foreground flex items-center gap-1 mb-1">
                            <Lightbulb className="h-3 w-3 text-amber-600" />
                            Ide Pitch WhatsApp Rekomendasi:
                          </span>
                          <p className="text-muted-foreground italic text-[11px]">
                            &ldquo;{brand.suggested_content_ideas[0]}&rdquo;
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <CardFooter className="p-4 pt-0 border-t border-border/50 pt-3 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (brand.marketing_phone) {
                          const cleanNumber = brand.marketing_phone.replace(/[^0-9]/g, '');
                          window.open(`https://wa.me/${cleanNumber}`, '_blank');
                        }
                      }}
                      className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/10"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Buka WhatsApp</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleMarkContactedWA(brand)}
                      className="h-8 text-xs"
                    >
                      Sudah Saya Hubungi
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: Jalur Alternatif / LinkedIn & DM Founder */}
        <TabsContent value="fallback" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-muted/40 rounded-xl border border-border/70 text-xs">
            <div className="flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-foreground">Filter Antrean Social Selling:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={linkedinTabFilter === 'fallback' ? 'secondary' : 'ghost'}
                onClick={() => setLinkedinTabFilter('fallback')}
                className="h-7 text-[11px] gap-1 px-2.5 font-medium"
              >
                <span>H+14 Email Hening</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {fallbackDmQueue.length}
                </Badge>
              </Button>
              <Button
                size="sm"
                variant={linkedinTabFilter === 'all' ? 'secondary' : 'ghost'}
                onClick={() => setLinkedinTabFilter('all')}
                className="h-7 text-[11px] gap-1 px-2.5 font-medium"
              >
                <span>Semua Target Ber-LinkedIn</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {brandsWithLinkedIn.length}
                </Badge>
              </Button>
            </div>
          </div>

          {displayedLinkedInQueue.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="h-8 w-8 text-blue-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                {linkedinTabFilter === 'fallback'
                  ? 'Tidak Ada Antrean H+14 DM Founder'
                  : 'Belum Ada Brand dengan Profil LinkedIn Terdeteksi'}
              </p>
              <p className="text-xs">
                {linkedinTabFilter === 'fallback'
                  ? 'Brand yang tidak membalas setelah 2x follow-up akan otomatis masuk ke sini untuk penjangkauan LinkedIn.'
                  : 'Jalankan Riset AI di Mission Control untuk melacak akun LinkedIn founder brand secara otomatis.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedLinkedInQueue.map((brand) => {
                const targetUrl = brand.founder_linkedin_url || brand.company_linkedin_url || brand.founder_instagram_url || 'https://linkedin.com';
                const targetName = brand.founder_name || brand.primary_pic_name || 'Founder';
                const targetRole = brand.primary_pic_role || (brand.founder_name ? 'Founder / CEO' : 'Partnership Team');
                const isGenerating = !!isGeneratingLinkedIn[brand.id];

                // Active format selection for this brand
                const currentFormat = linkedinFormat[brand.id] || 'connection_note';

                // Drafts resolution
                const savedDraft = linkedinDrafts[brand.id];
                const fallbackNote = `Hi ${targetName}! Huge fan of what you're building with ${brand.company_name}. Following from Indonesia where I create tech & dev education for 180k+ engineers. Would love to connect and share a few ideas on your SEA reach!`;
                const fallbackPitch = brand.dm_fallback_message || `Hi ${targetName},\n\nReally impressed by ${brand.company_name} and how it streamlines workflows. Following your growth closely from Indonesia.\n\nI run a 180k+ tech & software engineering community here, educating developers and productivity-focused professionals. We're putting together a deep-dive breakdown on modern tools and would love to showcase ${brand.company_name}.\n\nHappy to share our 1-page demographic kit or a quick concept if SEA creator partnerships are on your radar this quarter!`;

                const activeText =
                  currentFormat === 'connection_note'
                    ? savedDraft?.connectionNote || fallbackNote
                    : savedDraft?.inmailPitch || fallbackPitch;

                const charCount = activeText.length;
                const isConnectionNote = currentFormat === 'connection_note';

                return (
                  <Card key={brand.id} className="border-border/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                              {brand.company_name}
                              <Badge variant="outline" className="text-[10px]">
                                {brand.country}
                              </Badge>
                              {brand.niche_category && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {brand.niche_category}
                                </Badge>
                              )}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {brand.domain}
                            </p>
                          </div>
                          <Badge
                            variant={brand.pipeline_status === 'fallback_dm' ? 'warning' : 'outline'}
                            className="text-[10px]"
                          >
                            {brand.pipeline_status === 'fallback_dm' ? 'H+14 Email Hening' : brand.pipeline_status}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-2 space-y-3 text-xs">
                        {/* Target PIC & Direct Social Buttons */}
                        <div className="p-3 rounded-lg bg-card border border-border/80 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>Target: {targetName}</span>
                              <span className="text-[11px] text-muted-foreground font-normal">
                                ({targetRole})
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {brand.product_summary || 'Produk teknologi global'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {brand.founder_linkedin_url ? (
                              <a
                                href={brand.founder_linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[11px] font-medium transition-colors"
                                title="Buka LinkedIn Pribadi Founder"
                              >
                                <Linkedin className="h-3.5 w-3.5" />
                                <span>Profil</span>
                              </a>
                            ) : brand.company_linkedin_url ? (
                              <a
                                href={brand.company_linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[11px] font-medium transition-colors"
                                title="Buka LinkedIn Perusahaan"
                              >
                                <Linkedin className="h-3.5 w-3.5" />
                                <span>Company</span>
                              </a>
                            ) : null}

                            {brand.founder_instagram_url && (
                              <a
                                href={brand.founder_instagram_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 transition-colors"
                                title="Buka Instagram Founder"
                              >
                                <Instagram className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Format Switcher */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="inline-flex p-0.5 rounded-lg bg-muted border border-border/60">
                              <button
                                type="button"
                                onClick={() =>
                                  setLinkedinFormat((prev) => ({ ...prev, [brand.id]: 'connection_note' }))
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                  currentFormat === 'connection_note'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                🔗 Connection Note (≤300 kar)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setLinkedinFormat((prev) => ({ ...prev, [brand.id]: 'inmail_pitch' }))
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                  currentFormat === 'inmail_pitch'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                💬 InMail / DM Pitch
                              </button>
                            </div>

                            {/* Character Counter for Connection Note */}
                            {isConnectionNote && (
                              <span
                                className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                  charCount <= 290
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : charCount <= 300
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                }`}
                              >
                                {charCount}/300 kar
                              </span>
                            )}
                          </div>

                          {/* Message Box */}
                          <div className="relative group">
                            <div className="p-3 rounded-lg bg-muted/40 border border-border/70 text-foreground text-xs font-mono leading-relaxed select-all min-h-[72px] whitespace-pre-wrap">
                              {activeText}
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(activeText, isConnectionNote ? 'Connection Note' : 'InMail Pitch')}
                              className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/80 text-muted-foreground hover:text-foreground opacity-80 group-hover:opacity-100 transition-opacity"
                              title="Salin teks"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    <CardFooter className="p-4 pt-0 border-t border-border/50 pt-3 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isGenerating}
                        onClick={() => handleGenerateLinkedInPitch(brand)}
                        className="h-8 text-xs gap-1.5 text-blue-500 hover:text-blue-600 border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/10"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Menyusun...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Nova AI: Buat Ulang</span>
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleOpenAndCopyLinkedIn(brand, activeText, targetUrl)}
                          className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span>Buka &amp; Salin</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleMarkLinkedInSent(brand)}
                          className="h-8 text-xs gap-1"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Tandai Terhubung</span>
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Tandai Deal */}
      <Dialog open={!!dealModalBrand} onOpenChange={(open) => !open && setDealModalBrand(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Tandai Kesepakatan (Deal)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan estimasi total nilai kesepakatan sponsorship untuk {dealModalBrand?.company_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3 text-xs">
            <label className="font-semibold text-foreground">Nilai Kontrak ($ USD):</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Contoh: 3500"
                value={dealValueInput}
                onChange={(e) => setDealValueInput(e.target.value)}
                className="pl-9 h-9 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDealModalBrand(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={confirmDeal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              Konfirmasi Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
