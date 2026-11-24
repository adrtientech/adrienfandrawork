import { Brand, AppSettings } from '@/types/brand';
import { initialMockSettings } from '@/data/mock-settings';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY_BRANDS = 'creator_crm_brands_v1';
const STORAGE_KEY_SETTINGS = 'creator_crm_settings_v1';

const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

export class BrandService {
  /**
   * Mengambil semua brands (Memprioritaskan Supabase, fallback ke localStorage)
   */
  static async fetchBrands(): Promise<Brand[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as Brand[];
        }
      } catch (err) {
        console.warn('[BrandService] Gagal memuat dari Supabase, beralih ke cache lokal:', err);
      }
    }

    // Fallback: LocalStorage
    await delay();
    try {
      const data = localStorage.getItem(STORAGE_KEY_BRANDS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load brands from localStorage:', e);
    }

    return [];
  }

  /**
   * Mengambil 1 brand berdasarkan ID
   */
  static async fetchBrandById(id: string): Promise<Brand | null> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('brands').select('*').eq('id', id).single();
        if (!error && data) return data as Brand;
      } catch (err) {
        console.warn('[BrandService] Gagal fetch brand by id di Supabase:', err);
      }
    }

    const brands = await this.fetchBrands();
    return brands.find((b) => b.id === id) || null;
  }

  /**
   * Menambahkan brand baru
   */
  static async createBrand(
    payload: Omit<Brand, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Brand> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('brands')
          .insert({
            ...payload,
            domain: payload.domain.toLowerCase().trim(),
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error(`Domain "${payload.domain}" sudah terdaftar di database Supabase!`);
          }
          throw new Error(error.message);
        }

        if (data) return data as Brand;
      } catch (err: any) {
        if (err.message?.includes('sudah terdaftar')) throw err;
        console.warn('[BrandService] Fallback ke createBrand lokal:', err.message);
      }
    }

    // Fallback: LocalStorage
    await delay();
    const brands = await this.fetchBrands();
    const existing = brands.find(
      (b) => b.domain.toLowerCase() === payload.domain.toLowerCase().trim()
    );
    if (existing) {
      throw new Error(`Domain "${payload.domain}" sudah terdaftar dalam pipeline!`);
    }

    const now = new Date().toISOString();
    const newBrand: Brand = {
      ...payload,
      id: crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      domain: payload.domain.toLowerCase().trim(),
      created_at: now,
      updated_at: now,
    };

    const updated = [newBrand, ...brands];
    localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(updated));
    return newBrand;
  }

  /**
   * Memperbarui status / detail brand
   */
  static async updateBrand(id: string, updates: Partial<Brand>): Promise<Brand> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('brands')
          .update({ ...updates, updated_at: now })
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          return data as Brand;
        }
      } catch (err) {
        console.warn('[BrandService] Fallback ke updateBrand lokal:', err);
      }
    }

    // Fallback: LocalStorage
    await delay();
    const brands = await this.fetchBrands();
    const index = brands.findIndex((b) => b.id === id);

    if (index === -1) {
      throw new Error(`Brand dengan ID ${id} tidak ditemukan.`);
    }

    const updatedBrand: Brand = {
      ...brands[index],
      ...updates,
      updated_at: now,
    };

    brands[index] = updatedBrand;
    localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(brands));
    return updatedBrand;
  }

  /**
   * Menghapus brand
   */
  static async deleteBrand(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('brands').delete().eq('id', id);
        return;
      } catch (err) {
        console.warn('[BrandService] Gagal delete di Supabase:', err);
      }
    }

    const brands = await this.fetchBrands();
    const filtered = brands.filter((b) => b.id !== id);
    localStorage.setItem(STORAGE_KEY_BRANDS, JSON.stringify(filtered));
  }

  /**
   * Mengambil App Settings
   */
  static async fetchSettings(): Promise<AppSettings> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (!error && data) {
          return data as AppSettings;
        }
      } catch (err) {
        console.warn('[BrandService] Gagal fetch settings di Supabase:', err);
      }
    }

    // Fallback: LocalStorage
    await delay();
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(initialMockSettings));
    return { ...initialMockSettings };
  }

  /**
   * Memperbarui App Settings
   */
  static async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('settings')
          .update({ ...updates, updated_at: now })
          .eq('id', 1)
          .select()
          .single();

        if (!error && data) {
          return data as AppSettings;
        }
      } catch (err) {
        console.warn('[BrandService] Fallback updateSettings ke lokal:', err);
      }
    }

    // Fallback: LocalStorage
    await delay();
    const current = await this.fetchSettings();
    const updated: AppSettings = {
      ...current,
      ...updates,
      updated_at: now,
    };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    return updated;
  }

  /**
   * Panggil Agen AI Backend: Discover + Enrich
   */
  static async runAiDiscovery(): Promise<{ message: string; brand?: Brand }> {
    try {
      // 1. Coba panggil endpoint Express backend
      const res = await fetch('/api/agents/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 3 }),
      });

      if (res.ok) {
        const data = await res.json();
        // Lanjutkan jalankan enrich untuk brand yang baru ditemukan
        try {
          await fetch('/api/agents/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 3 }),
          });
        } catch {}

        return {
          message: data.message || 'Agen AI selesai mencari brand baru dari Google Serper & Gemini.',
          brand: data.brands?.[0],
        };
      }
    } catch (err) {
      console.info('[BrandService] Backend /api/agents/discover tidak merespon, menggunakan mode simulasi lokal.');
    }

    // Fallback simulasi jika backend server belum dinyalakan
    const brand = await this.simulateAiDiscovery();
    return {
      message: `[Mode Simulasi] AI menemukan brand baru: "${brand.company_name}" (Skor: ${brand.ai_fit_score})`,
      brand,
    };
  }

  /**
   * Panggil Agen AI Backend: Sync Inbox
   */
  static async runInboxSync(): Promise<{ newCount: number; message: string }> {
    try {
      const res = await fetch('/api/agents/sync-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        return {
          newCount: data.newRepliesCount || 0,
          message: data.message || 'Sinkronisasi inbox Gmail berhasil.',
        };
      }
    } catch (err) {
      console.info('[BrandService] Backend /api/agents/sync-inbox tidak merespon, menggunakan mode simulasi lokal.');
    }

    // Fallback simulasi
    return await this.simulateInboxCheck();
  }

  /**
   * Simulasi Fallback: "Cari Brand Baru (AI)"
   */
  static async simulateAiDiscovery(): Promise<Brand> {
    await delay(1200);
    const pool = [
      {
        company_name: 'Raycast Technologies',
        domain: 'raycast.com',
        website_url: 'https://raycast.com',
        country: 'United Kingdom',
        timezone: 'Europe/London',
        company_scale: 'startup' as const,
        employee_count_est: '20-50',
        niche_category: 'Productivity SaaS',
        product_summary: 'Blazingly fast, extendable launcher for Mac & Windows to control your tools in seconds.',
        ai_fit_score: 94,
        ai_fit_reason: 'Developer dan power user Indonesia gemar membagikan setup workspace dan script shortcut kustom.',
        suggested_content_ideas: [
          'Setup Raycast pengganti Spotlight: 10 ekstensi wajib untuk software engineer',
          'Automasi kirim email dan Jira ticket langsung dari keyboard'
        ],
        primary_pic_name: 'Thomas Paul Mann',
        primary_pic_role: 'Co-Founder & CEO',
        primary_email: 'thomas@raycast.com',
        email_verified: true,
        alternate_email: null,
        marketing_phone: null,
        company_instagram_url: null,
        company_linkedin_url: 'https://linkedin.com/company/raycast',
        founder_name: 'Thomas Paul Mann',
        founder_instagram_url: null,
        founder_linkedin_url: 'https://linkedin.com/in/thomaspaulmann',
        outreach_channel: 'email_auto' as const,
        pipeline_status: 'discovered' as const,
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
        notes: 'Ditemukan dari trending Product Hunt. Fit score tinggi (94).',
        email_history: [],
      },
      {
        company_name: 'Linear Orbit Inc',
        domain: 'linear.app',
        website_url: 'https://linear.app',
        country: 'United States',
        timezone: 'America/San_Francisco',
        company_scale: 'startup' as const,
        employee_count_est: '50-100',
        niche_category: 'Productivity SaaS',
        product_summary: 'Issue tracking tool standar emas untuk startup teknologi modern dan software product builder.',
        ai_fit_score: 89,
        ai_fit_reason: 'Banyak tech founders dan tech lead muda di Indonesia yang mengadopsi Linear Method.',
        suggested_content_ideas: [
          'Mengapa startup Silicon Valley beralih dari Jira ke Linear',
          'Tutorial sprint planning 15 menit menggunakan Linear Cycles'
        ],
        primary_pic_name: 'Karri Saarinen',
        primary_pic_role: 'CEO & Co-founder',
        primary_email: 'karri@linear.app',
        email_verified: true,
        alternate_email: null,
        marketing_phone: null,
        company_instagram_url: null,
        company_linkedin_url: 'https://linkedin.com/company/linear-app',
        founder_name: 'Karri Saarinen',
        founder_instagram_url: null,
        founder_linkedin_url: 'https://linkedin.com/in/ksaarinen',
        outreach_channel: 'email_auto' as const,
        pipeline_status: 'discovered' as const,
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
        notes: 'Scraped via GitHub trending ecosystem.',
        email_history: [],
      }
    ];

    const randomBrandData = pool[Math.floor(Math.random() * pool.length)];
    const brands = await this.fetchBrands();
    const exists = brands.some((b) => b.domain === randomBrandData.domain);
    if (exists) {
      randomBrandData.domain = `v2.${randomBrandData.domain}`;
    }

    return await this.createBrand(randomBrandData);
  }

  /**
   * Simulasi Fallback: "Cek Inbox Sekarang"
   */
  static async simulateInboxCheck(): Promise<{ newCount: number; message: string }> {
    await delay(1000);
    const brands = await this.fetchBrands();

    const targetBrand = brands.find((b) => b.pipeline_status === 'cold_sent' || b.pipeline_status === 'followup_1');

    if (targetBrand) {
      await this.updateBrand(targetBrand.id, {
        pipeline_status: 'in_progress',
        last_contacted_at: new Date().toISOString(),
        reply_summary: `${targetBrand.primary_pic_name || 'PIC'} baru saja membalas email! Tertarik mengetahui biaya paket video YouTube 1x dedicated.`,
        ai_draft_ready: true,
        ai_draft_content: `Hi ${targetBrand.primary_pic_name || 'there'}, thanks for getting back! We would love to collaborate. Our dedicated integration package starts at $2,500. Let me know if that aligns with your Q1 target.`,
        email_history: [
          ...targetBrand.email_history,
          {
            id: `eh-${Date.now()}`,
            direction: 'inbound',
            subject: `Re: Partnership with ${targetBrand.company_name}`,
            snippet: 'Hi Adrien, thanks for reaching out. Could you share your rate card and available dates?',
            sent_at: new Date().toISOString()
          }
        ]
      });
      return {
        newCount: 1,
        message: `1 balasan baru terdeteksi dari ${targetBrand.company_name}! Dipindahkan ke Action Queue.`
      };
    }

    return {
      newCount: 0,
      message: 'Inbox telah disinkronkan. Tidak ada balasan baru saat ini.'
    };
  }

  /**
   * Panggil Agen Nova: Generate LinkedIn Social Selling Pitch & Connection Note
   */
  static async generateLinkedInPitch(payload: {
    brandId?: string;
    companyName: string;
    domain?: string;
    productSummary?: string;
    founderName?: string;
    primaryPicName?: string;
    primaryPicRole?: string;
    founderLinkedinUrl?: string;
    companyLinkedinUrl?: string;
    nicheCategory?: string;
    country?: string;
    customAngle?: string;
  }): Promise<{
    connectionNote: string;
    connectionNoteCharCount: number;
    inmailPitch: string;
    followupNote: string;
    targetName: string;
    targetRole: string;
    targetLinkedinUrl: string;
    suggestedAngle: string;
  }> {
    try {
      const res = await fetch('/api/agents/linkedin-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('[BrandService] Backend /api/agents/linkedin-pitch gagal, beralih ke draf fallback cerdas:', e);
    }

    // Fallback cerdas jika offline / serverless delay
    const target = payload.founderName || payload.primaryPicName || 'Founder';
    const note = `Hi ${target}! Huge fan of what you're building with ${payload.companyName}. Following from Indonesia where I create tech & dev education for 180k+ engineers. Would love to connect and share a few ideas on your SEA reach!`;
    const pitch = `Hi ${target},\n\nReally impressed by ${payload.companyName} and how it streamlines workflows. Following your growth closely from Indonesia.\n\nI run a 180k+ tech & software engineering community here, educating developers and productivity-focused professionals. We're putting together a deep-dive breakdown on modern tools and would love to showcase ${payload.companyName}.\n\nHappy to share our 1-page demographic kit or a quick concept if SEA creator partnerships are on your radar this quarter!`;

    return {
      connectionNote: note,
      connectionNoteCharCount: note.length,
      inmailPitch: pitch,
      followupNote: `Hi ${target}, bumping this gently! Would love to share a quick 1-page audience breakdown for ${payload.companyName} whenever you have a moment.`,
      targetName: target,
      targetRole: payload.primaryPicRole || 'Founder / CEO',
      targetLinkedinUrl: payload.founderLinkedinUrl || payload.companyLinkedinUrl || 'https://linkedin.com',
      suggestedAngle: 'Productivity & developer workflow tutorial tailored for Indonesian tech talent.',
    };
  }

  /**
   * Reset / Bersihkan data brands (Clean Slate)
   */
  static async resetToDefaults(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn('Gagal reset brands di Supabase:', e);
      }
    }
    localStorage.removeItem(STORAGE_KEY_BRANDS);
  }
}
