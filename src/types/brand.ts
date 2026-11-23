export type CompanyScale = 'startup' | 'mid_market' | 'enterprise';

export type OutreachChannel =
  | 'email_auto'       // Pengiriman otomatis via Gmail API
  | 'manual_phone_wa'  // Ditahan AI karena ada nomor WA/telepon marketing
  | 'dm_founder';      // Jalur alternatif DM Instagram/LinkedIn pemilik brand

export type PipelineStatus =
  | 'discovered'    // Baru ditemukan oleh agen riset (Tahap A1 - 01-discovery.ts)
  | 'enriched'      // Sudah diriset web, skala, & founder + skor >= 50 (Tahap A2-A3 - 02-enrichment.ts)
  | 'verified'      // Email lulus DNS MX & Verifalia Bounce Shield (Tahap A4 - 03-verifier.ts)
  | 'skipped'       // Skor kecocokan < 50 atau email invalid/mental (Tidak Cocok / Skip)
  | 'ready_manual'  // Siap Dihubungi Manual via Nomor Telepon/WA Marketing (Tahap A4)
  | 'cold_sent'     // Sudah Dihubungi (Cold Sent - Tahap B1-B2 - 04-outreach.ts)
  | 'followup_1'    // Follow-Up 1 / Bump Thread (Hari ke-4 - Tahap C1 - 06-followup.ts)
  | 'followup_2'    // Follow-Up 2 / Value Drop (Hari ke-9 - Tahap C1 - 06-followup.ts)
  | 'fallback_dm'   // Pindah ke DM Founder / Jalur Alternatif (Hari ke-14 - Tahap C2)
  | 'in_progress'   // Dalam Proses (Brand tertarik, minta Media Kit / Rate Card / Meeting - Tahap B3)
  | 'deal'          // Deal (Kesepakatan kerja sama tercapai)
  | 'completed'     // Selesai (Kampanye telah tuntas & pembayaran lunas)
  | 'cancelled';    // Batal (Brand menolak atau belum ada budget ekspansi)

export interface EmailLogItem {
  id: string;
  direction: 'outbound' | 'inbound';
  subject: string;
  snippet: string;
  sent_at: string; // ISO timestamp
}

export interface Brand {
  id: string;
  company_name: string;
  domain: string; // Unique Key anti-duplikat (contoh: "wise.com")
  website_url: string | null;
  country: string; // Contoh: "United States", "Singapore", "Germany"
  timezone: string; // Contoh: "America/New_York", "Asia/Singapore"

  // Klasifikasi & Analisis AI (Tahap A2-A3)
  company_scale: CompanyScale;
  employee_count_est: string | null; // Contoh: "11-50"
  niche_category: string; // Contoh: "Fintech", "AI Productivity", "Edtech"
  product_summary: string | null;
  ai_fit_score: number; // 0 - 100
  ai_fit_reason: string | null;
  suggested_content_ideas: string[];

  // Kontak Utama & Pemilik (Tahap A3-A4)
  primary_pic_name: string | null;
  primary_pic_role: string | null; // Contoh: "Head of Growth", "Influencer Manager"
  primary_email: string | null;
  email_verified: boolean;
  alternate_email: string | null;
  marketing_phone: string | null;
  company_instagram_url: string | null;
  company_linkedin_url: string | null;

  // Khusus Startup & Menengah (One-on-One Founder)
  founder_name: string | null;
  founder_instagram_url: string | null;
  founder_linkedin_url: string | null;

  // Pelacakan Alur & Email Thread (Tahap B & C)
  outreach_channel: OutreachChannel;
  pipeline_status: PipelineStatus;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  gmail_draft_id: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  followup_count: number;

  // Ringkasan Inbox & Negosiasi AI (Tahap B3 & C)
  reply_summary: string | null;
  ai_draft_ready: boolean;
  ai_draft_content: string | null;
  dm_fallback_message: string | null;
  deal_value_usd: number | null;
  notes: string | null;
  email_history: EmailLogItem[];

  // Wave 1: Deal Optimization & Deliverability Guard
  has_partner_program?: boolean;
  buying_intent_signals?: string[];
  is_indonesia_accessible?: boolean;
  email_variant?: 'A' | 'B' | 'C' | null;
  do_not_contact?: boolean;
  replied_at?: string | null;

  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  is_global_paused: boolean;
  daily_email_limit: number;
  emails_sent_today: number;
  min_fit_score: number;
  followup_1_delay_days: number;
  followup_2_delay_days: number;
  fallback_delay_days: number;
  sender_name: string;
  sender_email: string;
  media_kit_pdf_url: string | null;
  discovery_keywords: string[];
  target_countries: string[];
  rope_system_prompt: string;
  reply_negotiation_prompt: string;
  dm_template_prompt: string;
  telegram_chat_id: string | null;
  updated_at: string;

  // Wave 1: Deliverability Guard & Proof Bank & Variants
  bounces_today?: number;
  max_daily_bounces?: number;
  enforce_business_hours?: boolean;
  active_email_variants?: ('A' | 'B' | 'C')[];
  variant_a_prompt?: string;
  variant_b_prompt?: string;
  variant_c_prompt?: string;
  creator_metrics?: string;
  creator_social_proof?: string;
  creator_content_style?: string;
}
