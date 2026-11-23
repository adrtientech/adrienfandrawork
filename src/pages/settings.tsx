import React, { useState, useEffect } from 'react';
import { useCrm } from '@/context/crm-context';
import { AppSettings } from '@/types/brand';
import {
  Sliders,
  Shield,
  Target,
  Cpu,
  Save,
  Plus,
  X,
  FileText,
  Mail,
  Send,
  RotateCcw,
  Sparkles,
  FlaskConical,
  AlertTriangle,
  Clock,
  Award
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetAllData } = useCrm();

  // Local form state
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync when settings change from context
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // Handle general field update
  const handleChange = (field: keyof AppSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Add Discovery Keyword
  const handleAddKeyword = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = newKeyword.trim();
    if (!val) return;
    if (formData.discovery_keywords.includes(val)) {
      toast.error('Keyword ini sudah ada di dalam daftar.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      discovery_keywords: [...prev.discovery_keywords, val],
    }));
    setNewKeyword('');
  };

  // Remove Discovery Keyword
  const handleRemoveKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      discovery_keywords: prev.discovery_keywords.filter((k) => k !== keyword),
    }));
  };

  // Add Target Country
  const handleAddCountry = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = newCountry.trim();
    if (!val) return;
    if (formData.target_countries.includes(val)) {
      toast.error('Negara ini sudah ada di dalam target.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      target_countries: [...prev.target_countries, val],
    }));
    setNewCountry('');
  };

  // Remove Target Country
  const handleRemoveCountry = (country: string) => {
    setFormData((prev) => ({
      ...prev,
      target_countries: prev.target_countries.filter((c) => c !== country),
    }));
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            AI Brain & Controls
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Konfigurasi parameter outreach, persona pengirim, kata kunci riset, dan prompt rekayasa AI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetAllData}
            className="text-xs h-9 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset ke Default</span>
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="text-xs h-9 gap-1.5 shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* KARTU 1: Identitas & Keamanan Pengiriman */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold">
                Kartu 1: Identitas Pengirim & Batasan Keamanan
              </CardTitle>
            </div>
            <CardDescription>
              Parameter akun pengirim dan limit harian untuk melindungi reputasi domain (anti-spam).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Nama Pengirim (Sender Name)</label>
                <Input
                  value={formData.sender_name}
                  onChange={(e) => handleChange('sender_name', e.target.value)}
                  placeholder="Contoh: Adrien Fandra"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Email Pengirim Resmi</label>
                <Input
                  type="email"
                  value={formData.sender_email}
                  onChange={(e) => handleChange('sender_email', e.target.value)}
                  placeholder="adrien@yourdomain.co"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Tautan Media Kit PDF</label>
                <Input
                  type="url"
                  value={formData.media_kit_pdf_url || ''}
                  onChange={(e) => handleChange('media_kit_pdf_url', e.target.value)}
                  placeholder="https://creatoroutbound.co/media-kit.pdf"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Telegram Chat ID (Notifikasi Deal)</label>
                <Input
                  value={formData.telegram_chat_id || ''}
                  onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                  placeholder="@username atau ID channel"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Batas Email / Hari</label>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={formData.daily_email_limit}
                  onChange={(e) => handleChange('daily_email_limit', parseInt(e.target.value) || 35)}
                  className="font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Disarankan max 35-50</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Min. Skor AI (0-100)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.min_fit_score}
                  onChange={(e) => handleChange('min_fit_score', parseInt(e.target.value) || 60)}
                  className="font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Brand di bawah ini di-skip</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Jeda Follow-up 1 (Hari)</label>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={formData.followup_1_delay_days}
                  onChange={(e) => handleChange('followup_1_delay_days', parseInt(e.target.value) || 4)}
                  className="font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Default: 4 hari</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Jeda Follow-up 2 (Hari)</label>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={formData.followup_2_delay_days}
                  onChange={(e) => handleChange('followup_2_delay_days', parseInt(e.target.value) || 5)}
                  className="font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Default: 5 hari</span>
              </div>
            </div>

            {/* Deliverability Guard & Circuit Breaker */}
            <div className="pt-3 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    Deliverability Guard: Enforce Business Hours
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Hanya kirim email pada hari Selasa, Rabu, dan Kamis pukul 08:30 – 11:30 waktu lokal negara brand.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium text-zinc-600">
                    {formData.enforce_business_hours ? 'Aktif' : 'Non-aktif'}
                  </span>
                  <Switch
                    checked={formData.enforce_business_hours ?? true}
                    onCheckedChange={(checked) => handleChange('enforce_business_hours', checked)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground flex items-center justify-between">
                    <span>Maks. Hard Bounce Harian (Circuit Breaker)</span>
                    <span className="text-[10px] font-mono text-zinc-400">Default: 2</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.max_daily_bounces ?? 2}
                    onChange={(e) => handleChange('max_daily_bounces', parseInt(e.target.value) || 2)}
                    className="font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Jika bounce hari ini melebihi angka ini, sistem otomatis mematikan pengiriman email global.
                  </span>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 block">
                    Status Bounce Hari Ini
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono tabular-nums text-zinc-900">
                      {formData.bounces_today ?? 0}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      / maks {formData.max_daily_bounces ?? 2} bounce
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    {(formData.bounces_today ?? 0) > (formData.max_daily_bounces ?? 2) ? (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Circuit Breaker terpicu!
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Reputasi domain aman (0-1 bounce).</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KARTU 2: Target Riset Brand */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">
                Kartu 2: Target Riset Brand & Wilayah Ekspansi
              </CardTitle>
            </div>
            <CardDescription>
              Tentukan kata kunci pencarian otomatis dan negara sasaran yang ingin diriset oleh agen AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-5 text-xs">
            {/* Tag Input: Discovery Keywords */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground block">
                Kata Kunci Penemuan Brand (Discovery Keywords):
              </label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-border/80 bg-background/60 items-center">
                {formData.discovery_keywords.map((kw) => (
                  <Badge
                    key={kw}
                    variant="secondary"
                    className="gap-1 py-1 px-2.5 text-xs font-normal"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-rose-500 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                  <Input
                    placeholder="Ketik keyword baru lalu tekan Enter..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleAddKeyword}
                    className="border-none shadow-none h-7 text-xs focus-visible:ring-0 bg-transparent"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddKeyword}
                    className="h-7 px-2 text-xs text-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Tambah
                  </Button>
                </div>
              </div>
            </div>

            {/* Tag Input: Target Countries */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground block">
                Negara Target (Target Countries):
              </label>
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-border/80 bg-background/60 items-center">
                {formData.target_countries.map((ct) => (
                  <Badge
                    key={ct}
                    variant="outline"
                    className="gap-1 py-1 px-2.5 text-xs font-normal border-blue-500/30 text-foreground"
                  >
                    <span>{ct}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(ct)}
                      className="hover:text-rose-500 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                  <Input
                    placeholder="Ketik nama negara baru lalu tekan Enter..."
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    onKeyDown={handleAddCountry}
                    className="border-none shadow-none h-7 text-xs focus-visible:ring-0 bg-transparent"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddCountry}
                    className="h-7 px-2 text-xs text-primary"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Tambah
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KARTU 3: Creator Proof Bank */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">
                Kartu 3: Creator Proof Bank (Otoritas & Bukti Nyata)
              </CardTitle>
            </div>
            <CardDescription>
              Bank data otoritas kreator yang disuntikkan langsung ke prompt AI agar draf pitching dan balasan selalu memiliki data konkret, kredibel, dan anti-template.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>Metrik & Demografi Audiens (Creator Metrics)</span>
                <span className="text-[10px] text-muted-foreground font-mono">Disuntikkan ke prompt</span>
              </label>
              <Textarea
                rows={3}
                value={formData.creator_metrics || ''}
                onChange={(e) => handleChange('creator_metrics', e.target.value)}
                placeholder="Contoh: 120k tech/developer audience di YouTube & LinkedIn, 65% usia 22-35 tahun (daya beli produktif), rata-rata 25k views organik per video panjang..."
                className="font-mono text-xs leading-relaxed"
              />
              <span className="text-[10px] text-muted-foreground">
                Jumlah followers, rata-rata views 30 hari, demografi usia/daya beli audiens Anda.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>Bukti Konversi & Portofolio Brand (Creator Social Proof)</span>
                <span className="text-[10px] text-muted-foreground font-mono">Disuntikkan ke prompt</span>
              </label>
              <Textarea
                rows={3}
                value={formData.creator_social_proof || ''}
                onChange={(e) => handleChange('creator_social_proof', e.target.value)}
                placeholder="Contoh: Kolaborasi sebelumnya: Supabase (450+ signups baru dari video tutorial), Warp (320 referral downloads), Linear, Cursor..."
                className="font-mono text-xs leading-relaxed"
              />
              <span className="text-[10px] text-muted-foreground">
                Daftar kolaborasi brand sebelumnya dan angka konversi/aksi nyata audiens Anda.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>Gaya & Sudut Pandang Konten Khas (Creator Content Style)</span>
                <span className="text-[10px] text-muted-foreground font-mono">Disuntikkan ke prompt</span>
              </label>
              <Textarea
                rows={3}
                value={formData.creator_content_style || ''}
                onChange={(e) => handleChange('creator_content_style', e.target.value)}
                placeholder="Contoh: Logic-first, mendalam, tanpa jargon marketing klise. Konten berfokus pada studi kasus nyata, arsitektur sistem, dan perbandingan teknikal yang jujur..."
                className="font-mono text-xs leading-relaxed"
              />
              <span className="text-[10px] text-muted-foreground">
                Karakteristik penyampaian khas Anda agar AI meniru gaya bicara alami Anda.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KARTU 4: A/B/C Testing Engine */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-500" />
              <CardTitle className="text-sm font-semibold">
                Kartu 4: A/B/C Testing Engine & Prompt Variasi
              </CardTitle>
            </div>
            <CardDescription>
              Uji performa berbagai sudut pandang cold email (Direct R.O.P.E., The Boss Redirect, dan Problem/Gap Angle) secara round-robin otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-5 text-xs">
            {/* Active Variant Checkboxes */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground block">
                Varian Aktif yang Dijalankan Engine:
              </label>
              <div className="flex items-center gap-3">
                {(['A', 'B', 'C'] as const).map((variantKey) => {
                  const isActive = (formData.active_email_variants || ['A', 'B', 'C']).includes(variantKey);
                  return (
                    <label
                      key={variantKey}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors",
                        isActive
                          ? "bg-violet-50/70 border-violet-200 text-violet-900"
                          : "bg-background/60 border-border/80 text-muted-foreground hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          const current = formData.active_email_variants || ['A', 'B', 'C'];
                          const updated = e.target.checked
                            ? [...current, variantKey]
                            : current.filter((v) => v !== variantKey);
                          if (updated.length === 0) {
                            toast.error('Minimal harus ada 1 varian aktif!');
                            return;
                          }
                          handleChange('active_email_variants', updated);
                        }}
                        className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span>Varian {variantKey}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {variantKey === 'A' && '(Direct R.O.P.E.)'}
                        {variantKey === 'B' && '(The Boss Redirect)'}
                        {variantKey === 'C' && '(Problem/Gap Angle)'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Variant A Prompt */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px]">A</span>
                  Varian A: Direct R.O.P.E. ke Marketing/Partnership Manager
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">Target: Head of Marketing / Partnerships</span>
              </div>
              <Textarea
                rows={3}
                value={formData.variant_a_prompt || ''}
                onChange={(e) => handleChange('variant_a_prompt', e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Variant B Prompt */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">B</span>
                  Varian B: The Boss Redirect (3 Kalimat Singkat ke Founder/CMO)
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">Target: Founder / C-Level</span>
              </div>
              <Textarea
                rows={3}
                value={formData.variant_b_prompt || ''}
                onChange={(e) => handleChange('variant_b_prompt', e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Variant C Prompt */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">C</span>
                  Varian C: Problem/Gap Angle (Edukasi Celah Pasar Indonesia)
                </label>
                <span className="text-[10px] font-mono text-muted-foreground">Target: Growth / Regional Lead</span>
              </div>
              <Textarea
                rows={3}
                value={formData.variant_c_prompt || ''}
                onChange={(e) => handleChange('variant_c_prompt', e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </CardContent>
        </Card>

        {/* KARTU 5: Otak & Prompt Rekayasa AI */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-purple-500" />
              <CardTitle className="text-sm font-semibold">
                Kartu 5: Otak & Prompt Negosiasi & DM (System Prompts)
              </CardTitle>
            </div>
            <CardDescription>
              Kustomisasi instruksi dan formula psikologis yang digunakan LLM untuk menyusun draf balasan negosiasi rate card dan pesan DM Founder.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-5 text-xs">
            {/* Prompt 1: R.O.P.E. System Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-blue-600" />
                  Formula Cold Email R.O.P.E. System Prompt (Global Fallback):
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  (Relevant, Objective, Proof, Easy Ask)
                </span>
              </div>
              <Textarea
                rows={4}
                value={formData.rope_system_prompt}
                onChange={(e) => handleChange('rope_system_prompt', e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Prompt 2: Reply & Negotiation Prompt */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-emerald-600" />
                Prompt Balasan Negosiasi & Bundling Tier Sponsorship:
              </label>
              <Textarea
                rows={4}
                value={formData.reply_negotiation_prompt}
                onChange={(e) => handleChange('reply_negotiation_prompt', e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Prompt 3: DM Fallback Prompt */}
            <div className="space-y-2">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-amber-600" />
                Prompt Draf DM Founder (LinkedIn / Instagram Alternative Path):
              </label>
              <Textarea
                rows={3}
                value={formData.dm_template_prompt}
                onChange={(e) => handleChange('dm_template_prompt', e.target.value)}
                className="font-mono text-xs leading-relaxed"
              />
            </div>
          </CardContent>

          <CardFooter className="p-5 border-t border-border/60 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Terakhir diperbarui: {formData.updated_at ? new Date(formData.updated_at).toLocaleString('id-ID') : '-'}
            </span>

            <Button type="submit" disabled={isSaving} size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};
