import React, { useState, useMemo } from 'react';
import { useCrm } from '@/context/crm-context';
import { Brand, PipelineStatus, OutreachChannel, CompanyScale } from '@/types/brand';
import {
  Search,
  Plus,
  ExternalLink,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Instagram,
  Linkedin,
  BrainCircuit,
  User,
  Clock,
  DollarSign,
  FileText,
  FilterX
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { formatDate, formatCurrencyUSD, cn } from '@/lib/utils';
import { toast } from 'sonner';

export const PipelinePage: React.FC = () => {
  const { brands, addBrand, updateBrand } = useCrm();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedScale, setSelectedScale] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Sheet detail state
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Modal tambah brand state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBrandForm, setNewBrandForm] = useState({
    company_name: '',
    domain: '',
    country: 'United States',
    company_scale: 'startup' as CompanyScale,
    niche_category: 'Fintech',
    outreach_channel: 'email_auto' as OutreachChannel,
    primary_pic_name: '',
    primary_email: '',
    product_summary: '',
  });

  // Selected brand object
  const activeBrand = useMemo(() => {
    return brands.find((b) => b.id === selectedBrandId) || null;
  }, [brands, selectedBrandId]);

  // Editable fields in Sheet detail
  const [sheetNotes, setSheetNotes] = useState('');
  const [sheetDealValue, setSheetDealValue] = useState<string>('');

  // Update sheet state whenever activeBrand changes
  React.useEffect(() => {
    if (activeBrand) {
      setSheetNotes(activeBrand.notes || '');
      setSheetDealValue(activeBrand.deal_value_usd != null ? String(activeBrand.deal_value_usd) : '');
    }
  }, [activeBrand]);

  // Unique lists for dropdowns
  const uniqueCountries = useMemo(() => {
    return Array.from(new Set(brands.map((b) => b.country))).sort();
  }, [brands]);

  // Filtered brands
  const filteredBrands = useMemo(() => {
    return brands.filter((brand) => {
      // Search text
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = brand.company_name.toLowerCase().includes(query);
        const matchesDomain = brand.domain.toLowerCase().includes(query);
        const matchesFounder = brand.founder_name?.toLowerCase().includes(query);
        if (!matchesName && !matchesDomain && !matchesFounder) return false;
      }

      // Country filter
      if (selectedCountry !== 'all' && brand.country !== selectedCountry) return false;

      // Scale filter
      if (selectedScale !== 'all' && brand.company_scale !== selectedScale) return false;

      // Channel filter
      if (selectedChannel !== 'all' && brand.outreach_channel !== selectedChannel) return false;

      // Status filter
      if (selectedStatus !== 'all' && brand.pipeline_status !== selectedStatus) return false;

      return true;
    });
  }, [brands, searchTerm, selectedCountry, selectedScale, selectedChannel, selectedStatus]);

  // Handle save in Sheet Detail
  const handleSaveSheetDetails = async () => {
    if (!activeBrand) return;
    try {
      const parsedDeal = sheetDealValue.trim() ? parseFloat(sheetDealValue) : null;
      await updateBrand(activeBrand.id, {
        notes: sheetNotes,
        deal_value_usd: parsedDeal,
      });
      toast.success('Catatan & Deal Value berhasil diperbarui!');
    } catch (e) {
      toast.error('Gagal memperbarui data.');
    }
  };

  // Quick Status change from Sheet
  const handleQuickStatusChange = async (newStatus: PipelineStatus) => {
    if (!activeBrand) return;
    await updateBrand(activeBrand.id, { pipeline_status: newStatus });
    toast.success(`Status brand diubah menjadi "${newStatus}"`);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCountry('all');
    setSelectedScale('all');
    setSelectedChannel('all');
    setSelectedStatus('all');
  };

  // Submit Add Brand
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandForm.company_name.trim() || !newBrandForm.domain.trim()) {
      toast.error('Nama Perusahaan dan Domain wajib diisi.');
      return;
    }

    try {
      await addBrand({
        company_name: newBrandForm.company_name.trim(),
        domain: newBrandForm.domain.trim(),
        website_url: `https://${newBrandForm.domain.trim()}`,
        country: newBrandForm.country,
        timezone: 'UTC',
        company_scale: newBrandForm.company_scale,
        employee_count_est: '10-50',
        niche_category: newBrandForm.niche_category,
        product_summary: newBrandForm.product_summary || 'Platform SaaS untuk efisiensi alur kerja digital.',
        ai_fit_score: 85,
        ai_fit_reason: 'Ditambahkan secara manual oleh kreator. Sangat potensial untuk endorsement pasar Indonesia.',
        suggested_content_ideas: [
          'Review fitur utama platform untuk meningkatkan produktivitas kreator'
        ],
        primary_pic_name: newBrandForm.primary_pic_name || null,
        primary_pic_role: 'Partnership Manager',
        primary_email: newBrandForm.primary_email || null,
        email_verified: !!newBrandForm.primary_email,
        alternate_email: null,
        marketing_phone: null,
        company_instagram_url: null,
        company_linkedin_url: null,
        founder_name: null,
        founder_instagram_url: null,
        founder_linkedin_url: null,
        outreach_channel: newBrandForm.outreach_channel,
        pipeline_status: 'discovered',
        gmail_thread_id: null,
        gmail_message_id: null,
        gmail_draft_id: null,
        last_contacted_at: null,
        next_followup_at: null,
        followup_count: 0,
        reply_summary: null,
        ai_draft_ready: false,
        ai_draft_content: null,
        dm_fallback_message: null,
        deal_value_usd: null,
        notes: 'Brand manual baru dimasukkan ke pipeline.',
        email_history: [],
      });

      setIsAddModalOpen(false);
      setNewBrandForm({
        company_name: '',
        domain: '',
        country: 'United States',
        company_scale: 'startup',
        niche_category: 'Fintech',
        outreach_channel: 'email_auto',
        primary_pic_name: '',
        primary_email: '',
        product_summary: '',
      });
    } catch (err: any) {
      // Error is handled in context
    }
  };

  // Helper badge for AI fit score (Emil Kowalski Craft UI)
  const renderAiScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="font-mono text-[10.5px] font-semibold tabular-nums text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80">
          {score}
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="font-mono text-[10.5px] font-medium tabular-nums text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/80">
          {score}
        </span>
      );
    }
    return (
      <span className="font-mono text-[10.5px] tabular-nums text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/50">
        {score}
      </span>
    );
  };

  // Helper label skala perusahaan sesuai Blueprint
  const renderScaleLabel = (scale: CompanyScale) => {
    switch (scale) {
      case 'startup':
        return 'Startup (<15)';
      case 'mid_market':
        return 'Mid (15–200)';
      case 'enterprise':
        return 'Enterprise (>200)';
      default:
        return scale;
    }
  };

  // Helper badge for Pipeline status (Craft Status Indicators)
  const renderStatusBadge = (status: PipelineStatus, emailVerified?: boolean) => {
    switch (status) {
      case 'discovered':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-100/70 px-2 py-0.5 rounded-full border border-zinc-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Discovered
          </span>
        );
      case 'enriched':
      case 'verified':
        return emailVerified ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-800" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-100/70 px-2 py-0.5 rounded-full border border-zinc-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Enriched
          </span>
        );
      case 'cold_sent':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Cold Sent
          </span>
        );
      case 'followup_1':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Follow-Up 1
          </span>
        );
      case 'followup_2':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" /> Follow-Up 2
          </span>
        );
      case 'ready_manual':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> WA Manual
          </span>
        );
      case 'fallback_dm':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> DM Founder
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-300 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" /> Dalam Proses
          </span>
        );
      case 'deal':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Deal
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> Selesai
          </span>
        );
      case 'skipped':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-200/50">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> {status === 'skipped' ? 'Skip' : 'Batal'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 bg-zinc-100/70 px-2 py-0.5 rounded-full border border-zinc-200/80">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Brand Pipeline
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredBrands.length} dari {brands.length}
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Database deduplikasi CRM, klasifikasi AI, profil kontak PIC, dan riwayat interaksi brand.
          </p>
        </div>

        {/* Add Brand Manual Button */}
        <Button
          onClick={() => setIsAddModalOpen(true)}
          size="sm"
          className="text-xs h-9 gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Brand Manual</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari brand, domain, atau founder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Filter: Country */}
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Semua Negara" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Negara</SelectItem>
              {uniqueCountries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter: Scale */}
          <Select value={selectedScale} onValueChange={setSelectedScale}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Semua Skala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Skala</SelectItem>
              <SelectItem value="startup">Startup</SelectItem>
              <SelectItem value="mid_market">Mid Market</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter: Channel */}
          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Semua Jalur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jalur</SelectItem>
              <SelectItem value="email_auto">Email Auto</SelectItem>
              <SelectItem value="manual_phone_wa">WA / Telp Marketing</SelectItem>
              <SelectItem value="dm_founder">DM Founder</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Bar Bottom: Status & Clear Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">Status:</span>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'in_progress', label: 'Balasan Masuk' },
              { id: 'ready_manual', label: 'WA Manual' },
              { id: 'fallback_dm', label: 'DM Founder' },
              { id: 'cold_sent', label: 'Cold Sent' },
              { id: 'deal', label: 'Deal' },
              { id: 'completed', label: 'Selesai' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors select-none",
                  selectedStatus === st.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          {(searchTerm || selectedCountry !== 'all' || selectedScale !== 'all' || selectedChannel !== 'all' || selectedStatus !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Reset Filter</span>
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">Brand & Domain</th>
                <th className="py-3 px-3">Negara</th>
                <th className="py-3 px-3">Skala</th>
                <th className="py-3 px-3 text-center">Skor AI</th>
                <th className="py-3 px-3 text-center">Varian</th>
                <th className="py-3 px-3">Jalur Outreach</th>
                <th className="py-3 px-3">Status Pipeline</th>
                <th className="py-3 px-4 text-right">Kontak Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">
                      {brands.length === 0 ? 'Belum ada brand di database' : 'Tidak ada brand yang cocok dengan filter'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {brands.length === 0
                        ? 'Jalankan "Riset AI" di Mission Control atau tekan "Tambah Brand Manual" di atas untuk memulai pipeline baru.'
                        : 'Coba ubah kata kunci pencarian atau reset filter di atas.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                  <tr
                    key={brand.id}
                    onClick={() => setSelectedBrandId(brand.id)}
                    className="hover:bg-accent/50 cursor-pointer transition-colors group"
                  >
                    {/* Brand Name + Domain */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                            <span>{brand.company_name}</span>
                            {brand.website_url && (
                              <a
                                href={brand.website_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-foreground inline-block"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {brand.has_partner_program && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="Ada program kreator / affiliate">
                                🤝 Partner
                              </span>
                            )}
                            {brand.do_not_contact && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                ⛔ Blacklist
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {brand.domain}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Country & Timezone */}
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      <div className="font-medium text-foreground">{brand.country}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{brand.timezone}</div>
                    </td>

                    {/* Scale */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {renderScaleLabel(brand.company_scale)}
                      </Badge>
                    </td>

                    {/* AI Score */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {renderAiScoreBadge(brand.ai_fit_score)}
                    </td>

                    {/* Email Variant */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {brand.email_variant ? (
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border",
                          brand.email_variant === 'A' ? "bg-blue-50 text-blue-700 border-blue-200" :
                          brand.email_variant === 'B' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          {brand.email_variant}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-300 font-mono">-</span>
                      )}
                    </td>

                    {/* Channel */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {brand.outreach_channel === 'email_auto' && '✉️ Email_Auto'}
                        {brand.outreach_channel === 'manual_phone_wa' && '📞 Manual_Phone_WA'}
                        {brand.outreach_channel === 'dm_founder' && '👤 DM_Founder'}
                      </span>
                    </td>

                    {/* Pipeline Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderStatusBadge(brand.pipeline_status, brand.email_verified)}
                    </td>

                    {/* Last Contacted */}
                    <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {formatDate(brand.last_contacted_at || brand.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Detail Sheet */}
      <Sheet open={!!selectedBrandId} onOpenChange={(open) => !open && setSelectedBrandId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl space-y-6">
          {activeBrand && (
            <div className="space-y-6">
              {/* Header */}
              <SheetHeader className="border-b border-border/80 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="text-xl font-bold flex items-center gap-2">
                      {activeBrand.company_name}
                      {activeBrand.website_url && (
                        <a
                          href={activeBrand.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline text-xs inline-flex items-center gap-1 font-normal"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </SheetTitle>
                    <SheetDescription className="font-mono text-xs mt-0.5">
                      {activeBrand.domain} • {activeBrand.country} • {activeBrand.niche_category}
                    </SheetDescription>
                  </div>

                  {/* Quick Status Select */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Status:</span>
                    <Select
                      value={activeBrand.pipeline_status}
                      onValueChange={(val) => handleQuickStatusChange(val as PipelineStatus)}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discovered">discovered</SelectItem>
                        <SelectItem value="enriched">enriched</SelectItem>
                        <SelectItem value="cold_sent">cold_sent</SelectItem>
                        <SelectItem value="followup_1">followup_1</SelectItem>
                        <SelectItem value="followup_2">followup_2</SelectItem>
                        <SelectItem value="ready_manual">ready_manual</SelectItem>
                        <SelectItem value="fallback_dm">fallback_dm</SelectItem>
                        <SelectItem value="in_progress">in_progress</SelectItem>
                        <SelectItem value="deal">deal</SelectItem>
                        <SelectItem value="completed">completed</SelectItem>
                        <SelectItem value="skipped">skipped</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <Badge variant="outline">{activeBrand.company_scale}</Badge>
                  <Badge variant="outline">Karyawan: {activeBrand.employee_count_est || 'N/A'}</Badge>
                  <Badge variant="secondary">Zona Waktu: {activeBrand.timezone}</Badge>
                  {activeBrand.email_variant && (
                    <Badge variant="outline" className="font-mono bg-violet-50 text-violet-700 border-violet-200">
                      Varian {activeBrand.email_variant}
                    </Badge>
                  )}
                  {activeBrand.has_partner_program && (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                      🤝 Program Partner / Affiliate
                    </Badge>
                  )}
                  {activeBrand.do_not_contact && (
                    <Badge variant="destructive">
                      ⛔ Do Not Contact (Opt-Out)
                    </Badge>
                  )}
                  {activeBrand.is_indonesia_accessible === false && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                      ⚠️ Tidak Aksesibel di ID
                    </Badge>
                  )}
                  {activeBrand.replied_at && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      Balasan: {formatDate(activeBrand.replied_at)}
                    </Badge>
                  )}
                </div>
              </SheetHeader>

              {/* Seksi Analisis AI */}
              <div className="space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                    <BrainCircuit className="h-4 w-4" />
                    <span>Analisis Kesesuaian AI (Fit Score)</span>
                  </div>
                  {renderAiScoreBadge(activeBrand.ai_fit_score)}
                </div>

                <p className="text-xs text-foreground font-medium">
                  {activeBrand.product_summary}
                </p>

                {/* Sinyal Niat Beli */}
                {activeBrand.buying_intent_signals && activeBrand.buying_intent_signals.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-blue-200/50">
                    <span className="text-[10.5px] font-semibold text-blue-900 uppercase tracking-wider block">
                      Sinyal Niat Beli (High-Intent Buying Signals):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeBrand.buying_intent_signals.map((signal, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-white text-blue-800 border border-blue-200 shadow-2xs"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeBrand.ai_fit_reason && (
                  <div className="text-xs text-muted-foreground bg-background/60 p-2.5 rounded-lg border border-border/50">
                    <span className="font-semibold text-foreground">Alasan AI: </span>
                    {activeBrand.ai_fit_reason}
                  </div>
                )}

                {activeBrand.suggested_content_ideas && activeBrand.suggested_content_ideas.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                      Ide Konsep Konten Rekomendasi:
                    </span>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 pl-1">
                      {activeBrand.suggested_content_ideas.map((idea, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {idea}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Seksi Kontak & Profil Pemilik */}
              <div className="space-y-3 p-4 rounded-xl border border-border bg-card/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <User className="h-4 w-4 text-primary" />
                  <span>Kontak Utama & Profil Pemilik</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* PIC Info */}
                  <div className="p-3 rounded-lg bg-background/70 border border-border/60 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Person In Charge (PIC)
                    </span>
                    <p className="font-bold text-foreground">
                      {activeBrand.primary_pic_name || 'Belum Terdeteksi'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {activeBrand.primary_pic_role || '-'}
                    </p>
                    {activeBrand.primary_email && (
                      <div className="flex items-center gap-1.5 mt-2 font-mono text-[11px]">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{activeBrand.primary_email}</span>
                        {activeBrand.email_verified ? (
                          <span title="Email Terverifikasi" className="shrink-0 inline-flex">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          </span>
                        ) : (
                          <span title="Email Belum Terverifikasi" className="shrink-0 inline-flex">
                            <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Founder Profile */}
                  <div className="p-3 rounded-lg bg-background/70 border border-border/60 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Founder / Owner
                    </span>
                    <p className="font-bold text-foreground">
                      {activeBrand.founder_name || 'N/A'}
                    </p>
                    <div className="flex items-center gap-2 pt-1.5">
                      {activeBrand.founder_instagram_url && (
                        <a
                          href={activeBrand.founder_instagram_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground"
                        >
                          <Instagram className="h-3.5 w-3.5 text-pink-500" />
                          <span>Instagram</span>
                        </a>
                      )}
                      {activeBrand.founder_linkedin_url && (
                        <a
                          href={activeBrand.founder_linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground"
                        >
                          <Linkedin className="h-3.5 w-3.5 text-blue-500" />
                          <span>LinkedIn</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* WhatsApp Phone if available */}
                {activeBrand.marketing_phone && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-medium">
                      <Phone className="h-4 w-4" />
                      <span>Nomor Marketing Terdeteksi: {activeBrand.marketing_phone}</span>
                    </div>
                    <a
                      href={`https://wa.me/${activeBrand.marketing_phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                    >
                      Buka WA
                    </a>
                  </div>
                )}
              </div>

              {/* Seksi Riwayat Email & Catatan */}
              <div className="space-y-4 p-4 rounded-xl border border-border bg-card/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Riwayat Email & Negosiasi Deal</span>
                  </div>
                  {activeBrand.deal_value_usd && (
                    <Badge variant="success" className="font-mono text-xs">
                      {formatCurrencyUSD(activeBrand.deal_value_usd)}
                    </Badge>
                  )}
                </div>

                {/* Reply Summary if available */}
                {activeBrand.reply_summary && (
                  <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs text-foreground space-y-1">
                    <span className="font-bold text-indigo-400">Ringkasan Respon Masuk (AI):</span>
                    <p className="leading-relaxed">{activeBrand.reply_summary}</p>
                  </div>
                )}

                {/* Email History Timeline */}
                {activeBrand.email_history && activeBrand.email_history.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Thread Email ({activeBrand.email_history.length} pesan)
                    </span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {activeBrand.email_history.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            "p-2.5 rounded-lg border text-xs",
                            log.direction === 'inbound'
                              ? "bg-emerald-500/5 border-emerald-500/30 text-foreground"
                              : "bg-muted/40 border-border/60 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between font-semibold mb-0.5">
                            <span>{log.direction === 'inbound' ? '📥 Diterima' : '📤 Dikirim'}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {formatDate(log.sent_at)}
                            </span>
                          </div>
                          <p className="font-medium text-foreground">{log.subject}</p>
                          <p className="text-[11px] line-clamp-2 mt-0.5">{log.snippet}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit Deal Value & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Nilai Deal ($ USD):
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="Contoh: 3500"
                        value={sheetDealValue}
                        onChange={(e) => setSheetDealValue(e.target.value)}
                        className="pl-8 h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Catatan Internal:
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="Tulis catatan negosiasi atau reminder khusus..."
                      value={sheetNotes}
                      onChange={(e) => setSheetNotes(e.target.value)}
                      className="text-xs min-h-[60px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={handleSaveSheetDetails} className="text-xs h-8">
                    Simpan Perubahan
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal Tambah Brand Manual */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreateBrand}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Tambah Brand Manual ke Pipeline
              </DialogTitle>
              <DialogDescription className="text-xs">
                Masukkan nama dan domain unik brand. Sistem otomatis memvalidasi duplikasi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Nama Perusahaan *</label>
                <Input
                  required
                  placeholder="Contoh: Notion Labs"
                  value={newBrandForm.company_name}
                  onChange={(e) => setNewBrandForm({ ...newBrandForm, company_name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Domain Website * (Kunci Unik Anti-Double)</label>
                <Input
                  required
                  placeholder="Contoh: notion.so"
                  value={newBrandForm.domain}
                  onChange={(e) => setNewBrandForm({ ...newBrandForm, domain: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Negara Asal</label>
                  <Input
                    placeholder="Contoh: United States"
                    value={newBrandForm.country}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, country: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Skala Perusahaan</label>
                  <Select
                    value={newBrandForm.company_scale}
                    onValueChange={(val) => setNewBrandForm({ ...newBrandForm, company_scale: val as CompanyScale })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startup">Startup</SelectItem>
                      <SelectItem value="mid_market">Mid Market</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Nama PIC</label>
                  <Input
                    placeholder="Contoh: Sarah Connor"
                    value={newBrandForm.primary_pic_name}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, primary_pic_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Email PIC</label>
                  <Input
                    type="email"
                    placeholder="sarah@company.com"
                    value={newBrandForm.primary_email}
                    onChange={(e) => setNewBrandForm({ ...newBrandForm, primary_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Ringkasan Produk</label>
                <Textarea
                  placeholder="Contoh: AI Productivity Tool untuk manajemen dokumen..."
                  value={newBrandForm.product_summary}
                  onChange={(e) => setNewBrandForm({ ...newBrandForm, product_summary: e.target.value })}
                  className="min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm">
                Tambahkan ke Pipeline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
