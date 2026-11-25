import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Shield,
  ShieldAlert,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  FileCheck,
  Ban,
  Tag,
  Clock,
  Sparkles,
  HelpCircle,
  FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface VaultDoc {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  category: 'rate_card' | 'case_study' | 'contract' | 'custom';
  triggerContext: 'rate_request' | 'proof_request' | 'contract_deal' | 'custom';
  contextRule: string;
  isColdEmailAllowed: boolean;
  uploadedAt: string;
  url: string;
}

interface ExcludedBrandItem {
  id: string;
  name: string;
  domain?: string;
  reason: string;
  addedAt: string;
}

export const AssetVaultPage: React.FC = () => {
  const [documents, setDocuments] = useState<VaultDoc[]>([]);
  const [excludedBrands, setExcludedBrands] = useState<ExcludedBrandItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [isLoadingExcluded, setIsLoadingExcluded] = useState<boolean>(true);

  // Form input document
  const [newTitle, setNewTitle] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newCategory, setNewCategory] = useState<'rate_card' | 'case_study' | 'contract' | 'custom'>('rate_card');
  const [newContextRule, setNewContextRule] = useState('');
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  // Form input blacklist brand
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDomain, setNewBrandDomain] = useState('');
  const [newBrandReason, setNewBrandReason] = useState('');
  const [isAddingBrand, setIsAddingBrand] = useState(false);

  // Load documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/vault/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.warn('Gagal memuat dokumen vault:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Load excluded brands
  const fetchExcludedBrands = async () => {
    try {
      const res = await fetch('/api/excluded-brands');
      if (res.ok) {
        const data = await res.json();
        setExcludedBrands(data.excludedBrands || []);
      }
    } catch (err) {
      console.warn('Gagal memuat excluded brands:', err);
    } finally {
      setIsLoadingExcluded(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchExcludedBrands();
  }, []);

  // Handle add document
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newFileName.trim()) {
      toast.error('Judul dan nama file wajib diisi');
      return;
    }

    try {
      const triggerContextMap = {
        rate_card: 'rate_request',
        case_study: 'proof_request',
        contract: 'contract_deal',
        custom: 'custom',
      } as const;

      const res = await fetch('/api/vault/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          fileName: newFileName.trim().endsWith('.pdf') ? newFileName.trim() : `${newFileName.trim()}.pdf`,
          fileSize: '1.8 MB',
          category: newCategory,
          triggerContext: triggerContextMap[newCategory],
          contextRule: newContextRule.trim() || 'Hanya dikirim saat brand secara eksplisit meminta dokumen ini.',
        }),
      });

      if (res.ok) {
        toast.success(`Dokumen "${newTitle}" berhasil ditambahkan ke Vault AI!`);
        setNewTitle('');
        setNewFileName('');
        setNewContextRule('');
        setIsAddingDoc(false);
        fetchDocuments();
      }
    } catch {
      toast.error('Gagal menambahkan dokumen');
    }
  };

  // Handle delete document
  const handleDeleteDoc = async (id: string, title: string) => {
    if (!window.confirm(`Hapus dokumen "${title}" dari Vault?`)) return;
    try {
      const res = await fetch(`/api/vault/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.info('Dokumen dihapus dari Vault');
        fetchDocuments();
      }
    } catch {
      toast.error('Gagal menghapus dokumen');
    }
  };

  // Handle add excluded brand
  const handleAddExcludedBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
      toast.error('Nama brand wajib diisi');
      return;
    }

    try {
      const res = await fetch('/api/excluded-brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBrandName.trim(),
          domain: newBrandDomain.trim() || undefined,
          reason: newBrandReason.trim() || 'Dikecualikan atas instruksi Adrien Fandra',
        }),
      });

      if (res.ok) {
        toast.success(`Brand "${newBrandName}" berhasil dimasukkan ke Blacklist!`);
        setNewBrandName('');
        setNewBrandDomain('');
        setNewBrandReason('');
        setIsAddingBrand(false);
        fetchExcludedBrands();
      }
    } catch {
      toast.error('Gagal mengecualikan brand');
    }
  };

  // Handle delete excluded brand
  const handleDeleteExcluded = async (id: string, name: string) => {
    if (!window.confirm(`Hapus brand "${name}" dari blacklist?`)) return;
    try {
      const res = await fetch(`/api/excluded-brands/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.info(`Brand "${name}" dihapus dari blacklist`);
        fetchExcludedBrands();
      }
    } catch {
      toast.error('Gagal menghapus brand dari blacklist');
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50/50 overflow-y-auto">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-200/80 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight">
              Asset Vault & Knowledge Base
            </h1>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/70">
              <Shield className="h-3 w-3 text-emerald-600" />
              Context-Aware Engine
            </span>
          </div>
          <p className="text-[11px] sm:text-[12px] text-zinc-400 mt-0.5">
            Penyimpanan dokumen PDF & aturan penolakan brand (AI hanya mengirim lampiran saat diminta & sesuai konteks).
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => setIsAddingDoc(!isAddingDoc)}
            className="h-8 px-3 text-xs bg-zinc-950 hover:bg-zinc-900 text-white gap-1.5 craft-button shadow-2xs w-full sm:w-auto justify-center"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Dokumen</span>
          </Button>
        </div>
      </div>

      <div className="p-3.5 sm:p-6 max-w-6xl w-full mx-auto space-y-4 sm:space-y-6">
        {/* Aturan Baku Cold Outreach Shield */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-100 border border-zinc-200/80 text-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-[12px] space-y-1">
            <div className="font-semibold text-zinc-900 flex items-center gap-2">
              <span>Aturan Baku Pengiriman Dokumen Otomatis:</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                0 Attachment Cold Outreach Shield
              </span>
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Semua dokumen di bawah ini <b>TIDAK PERNAH</b> dilampirkan pada email dingin pertama (Cold Outreach). Staf AI Orion selalu mengirimkan email teks murni 3 paragraf tanpa lampiran agar tidak terdeteksi filter spam Gmail/Google Workspace. Dokumen di Vault ini hanya akan dipanggil oleh staf AI Echo saat brand <b>secara eksplisit membalas meminta rate card, bukti performa, atau kontrak deal</b>.
            </p>
          </div>
        </div>

        {/* Form Tambah Dokumen (Expandable) */}
        {isAddingDoc && (
          <form
            onSubmit={handleAddDocument}
            className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Tambah Dokumen / PDF Baru ke Vault
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingDoc(false)}
                className="text-xs text-zinc-400 hover:text-zinc-700"
              >
                Batal
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Nama / Judul Dokumen
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Media Kit Resmi Adrien Fandra Q1 2026"
                  className="h-8 text-xs bg-zinc-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Nama File Dokumen (.pdf)
                </label>
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Contoh: MediaKit_Adrien_2026.pdf"
                  className="h-8 text-xs bg-zinc-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Kategori Dokumen
                </label>
                <select
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-zinc-200 text-xs bg-zinc-50/50 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="rate_card">Rate Card / Paket Harga Sponsorship</option>
                  <option value="case_study">Case Study & Demografi Audiens</option>
                  <option value="contract">Standard Agreement / Kontrak Deal</option>
                  <option value="custom">Kustom / Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Aturan Konteks untuk AI (Kapan Harus Dikirim?)
                </label>
                <Input
                  value={newContextRule}
                  onChange={(e) => setNewContextRule(e.target.value)}
                  placeholder="Contoh: Kirim saat brand meminta rate card atau proposal harga"
                  className="h-8 text-xs bg-zinc-50/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingDoc(false)}
                className="h-7 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs bg-zinc-950 text-white craft-button shadow-2xs"
              >
                Simpan Dokumen ke Vault
              </Button>
            </div>
          </form>
        )}

        {/* Daftar Dokumen di Vault */}
        <div className="rounded-xl border border-zinc-200/90 bg-white overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-zinc-700" />
              <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Dokumen Tersimpan di Vault ({documents.length})
              </h2>
            </div>
            <span className="text-[11px] text-zinc-400">
              Otomatis dipanggil AI sesuai konteks
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Belum ada dokumen tersimpan di Vault. Klik tombol "Tambah Dokumen" di atas.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200/70 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-zinc-900">
                          {doc.title}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                          {doc.fileName}
                        </span>
                        <span className="text-[10px] text-zinc-400 tabular-nums">
                          {doc.fileSize}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-500">
                        <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                        <span><b>Aturan AI:</b> {doc.contextRule}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Siap Dipanggil AI
                    </span>
                    <button
                      onClick={() => handleDeleteDoc(doc.id, doc.title)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Hapus dari Vault"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION: BRAND YANG DIKECUALIKAN (BLACKLIST) */}
        <div className="rounded-xl border border-zinc-200/90 bg-white overflow-hidden shadow-2xs">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-rose-500" />
              <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Daftar Brand yang Dikecualikan / Blacklist ({excludedBrands.length})
              </h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingBrand(!isAddingBrand)}
              className="h-7 text-xs gap-1 craft-button"
            >
              <Plus className="h-3 w-3" />
              <span>Kecualikan Brand</span>
            </Button>
          </div>

          <div className="p-4 bg-zinc-50/50 border-b border-zinc-100 text-[11.5px] text-zinc-500 flex items-center gap-2">
            <HelpCircle className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span>
              Anda juga bisa langsung memerintahkan Manajer Utama di chat: <i>"Kecualikan brand X dan Y"</i>, dan nama brand akan otomatis tercatat di daftar ini secara permanen.
            </span>
          </div>

          {/* Form Tambah Blacklist Brand (Expandable) */}
          {isAddingBrand && (
            <form
              onSubmit={handleAddExcludedBrand}
              className="p-4 border-b border-zinc-200/80 bg-white space-y-3 animate-in fade-in duration-200"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Nama Brand
                  </label>
                  <Input
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="Contoh: Canva atau Binance"
                    className="h-8 text-xs bg-zinc-50/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Domain Website (Opsional)
                  </label>
                  <Input
                    value={newBrandDomain}
                    onChange={(e) => setNewBrandDomain(e.target.value)}
                    placeholder="Contoh: canva.com"
                    className="h-8 text-xs bg-zinc-50/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Alasan Pengecualian
                  </label>
                  <Input
                    value={newBrandReason}
                    onChange={(e) => setNewBrandReason(e.target.value)}
                    placeholder="Contoh: Brand crypto / kompetitor langsung"
                    className="h-8 text-xs bg-zinc-50/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingBrand(false)}
                  className="h-7 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white craft-button shadow-2xs"
                >
                  Kecualikan Brand
                </Button>
              </div>
            </form>
          )}

          <div className="divide-y divide-zinc-100">
            {excludedBrands.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                Belum ada brand yang dikecualikan.
              </div>
            ) : (
              excludedBrands.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                      <Ban className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold text-zinc-900">
                          {item.name}
                        </span>
                        {item.domain && (
                          <span className="text-[10.5px] font-mono text-zinc-400">
                            ({item.domain})
                          </span>
                        )}
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500">
                          Tidak Pernah Didekati
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Alasan: {item.reason}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteExcluded(item.id, item.name)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                    title="Hapus dari blacklist"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
