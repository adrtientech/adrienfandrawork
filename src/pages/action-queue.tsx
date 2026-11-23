import React, { useState } from 'react';
import { useCrm } from '@/context/crm-context';
import { Brand } from '@/types/brand';
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
  AlertCircle
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
  const { replyQueue, manualPhoneQueue, fallbackDmQueue, updateBrand } = useCrm();

  // State for editable AI drafts in Tab 1
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

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
            <span>Jalur DM Founder</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500">
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

        {/* TAB 3: Jalur Alternatif / DM Founder */}
        <TabsContent value="fallback" className="space-y-4">
          {fallbackDmQueue.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Tidak Ada Antrean DM Founder</p>
              <p className="text-xs">Brand yang tidak membalas setelah 2x follow-up akan otomatis masuk ke sini.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fallbackDmQueue.map((brand) => (
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
                        <Badge variant="warning" className="text-[10px]">
                          2x Follow-up Hening
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3 text-xs">
                      {/* Founder Info & Links */}
                      <div className="p-3 rounded-lg bg-card border border-border/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            Founder: {brand.founder_name || 'Founder'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {brand.founder_instagram_url && (
                              <a
                                href={brand.founder_instagram_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded bg-pink-500/10 text-pink-500 hover:bg-pink-500/20"
                                title="Buka Instagram Founder"
                              >
                                <Instagram className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {brand.founder_linkedin_url && (
                              <a
                                href={brand.founder_linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                                title="Buka LinkedIn Founder"
                              >
                                <Linkedin className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DM Fallback Message Box */}
                      <div className="space-y-1.5">
                        <span className="font-semibold text-foreground flex items-center justify-between">
                          <span>Draf Pesan DM (Singkat & Santai):</span>
                          <button
                            onClick={() => copyToClipboard(brand.dm_fallback_message || '', 'Pesan DM')}
                            className="text-[11px] text-primary hover:underline flex items-center gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy Pesan DM</span>
                          </button>
                        </span>
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/70 text-foreground text-xs font-mono leading-relaxed select-all">
                          {brand.dm_fallback_message || 'Hi, just dropped a quick email about our Indonesian audience expansion!'}
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter className="p-4 pt-0 border-t border-border/50 pt-3 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkCancelled(brand)}
                      className="h-8 text-xs text-muted-foreground hover:text-rose-400"
                    >
                      Batal
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleMarkDmSent(brand)}
                      className="h-8 text-xs gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Tandai DM Terkirim</span>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
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
