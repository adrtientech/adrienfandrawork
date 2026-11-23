-- ============================================================
-- SCHEMA DATABASE: CREATOR OUTBOUND AI CRM
-- Kompatibel dengan Supabase PostgreSQL
-- ============================================================

-- 1. FUNGSI OTOMATIS UPDATE TIMESTAMP (updated_at)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TABEL UTAMA: brands (CRM & Deduplikasi Pipeline)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE, -- Kunci utama pencegah double pitching
  website_url TEXT,
  country TEXT NOT NULL DEFAULT 'Unknown',
  timezone TEXT NOT NULL DEFAULT 'UTC',

  -- Klasifikasi & Analisis AI
  company_scale TEXT NOT NULL DEFAULT 'startup'
    CHECK (company_scale IN ('startup', 'mid_market', 'enterprise')),
  employee_count_est TEXT,
  niche_category TEXT NOT NULL DEFAULT 'General',
  product_summary TEXT,
  ai_fit_score INTEGER NOT NULL DEFAULT 0
    CHECK (ai_fit_score >= 0 AND ai_fit_score <= 100),
  ai_fit_reason TEXT,
  suggested_content_ideas TEXT[] NOT NULL DEFAULT '{}',

  -- Kontak & Profil Pemilik
  primary_pic_name TEXT,
  primary_pic_role TEXT,
  primary_email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  alternate_email TEXT,
  marketing_phone TEXT,
  company_instagram_url TEXT,
  company_linkedin_url TEXT,
  founder_name TEXT,
  founder_instagram_url TEXT,
  founder_linkedin_url TEXT,

  -- Status & Pelacakan Otomatisasi
  outreach_channel TEXT NOT NULL DEFAULT 'email_auto'
    CHECK (outreach_channel IN ('email_auto', 'manual_phone_wa', 'dm_founder')),
  pipeline_status TEXT NOT NULL DEFAULT 'discovered'
    CHECK (pipeline_status IN (
      'discovered', 'enriched', 'verified', 'skipped', 'ready_manual',
      'cold_sent', 'followup_1', 'followup_2', 'fallback_dm',
      'in_progress', 'deal', 'completed', 'cancelled'
    )),
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  gmail_draft_id TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  followup_count INTEGER NOT NULL DEFAULT 0,

  -- Negosiasi & Riwayat
  reply_summary TEXT,
  ai_draft_ready BOOLEAN NOT NULL DEFAULT FALSE,
  ai_draft_content TEXT,
  dm_fallback_message TEXT,
  deal_value_usd NUMERIC(10, 2),
  notes TEXT,
  email_history JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk query cepat dashboard & cron runner
CREATE INDEX IF NOT EXISTS idx_brands_status ON public.brands (pipeline_status);
CREATE INDEX IF NOT EXISTS idx_brands_country ON public.brands (country);
CREATE INDEX IF NOT EXISTS idx_brands_channel ON public.brands (outreach_channel);
CREATE INDEX IF NOT EXISTS idx_brands_next_followup ON public.brands (next_followup_at)
  WHERE pipeline_status IN ('cold_sent', 'followup_1', 'followup_2');
CREATE INDEX IF NOT EXISTS idx_brands_gmail_thread ON public.brands (gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_brands_updated_at ON public.brands;
CREATE TRIGGER set_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. TABEL PENGATURAN: settings (Singleton Row id = 1)
CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_global_paused BOOLEAN NOT NULL DEFAULT FALSE,
  daily_email_limit INTEGER NOT NULL DEFAULT 35,
  emails_sent_today INTEGER NOT NULL DEFAULT 0,
  min_fit_score INTEGER NOT NULL DEFAULT 60,
  followup_1_delay_days INTEGER NOT NULL DEFAULT 4,
  followup_2_delay_days INTEGER NOT NULL DEFAULT 5,
  fallback_delay_days INTEGER NOT NULL DEFAULT 5,
  sender_name TEXT NOT NULL DEFAULT 'Adrien Fandra',
  sender_email TEXT NOT NULL DEFAULT 'adrien@yourdomain.co',
  media_kit_pdf_url TEXT,
  discovery_keywords TEXT[] NOT NULL DEFAULT ARRAY[
    'personal finance app global',
    'AI productivity tool SaaS',
    'fintech investing platform SEA',
    'edtech career platform international',
    'global remote work tools'
  ],
  target_countries TEXT[] NOT NULL DEFAULT ARRAY[
    'United States', 'Singapore', 'United Kingdom', 'Germany', 'Australia', 'Japan'
  ],
  rope_system_prompt TEXT NOT NULL DEFAULT
    'Write a concise cold email (under 100 words, 3 paragraphs, zero attachments) using the R.O.P.E. framework. Never open with "My name is". Start with a specific observation about the brand, bridge to helping them educate and acquire young Indonesian users, include 1 concrete content concept, and end with a low-friction question asking if they are open to Indonesian creator partnerships this quarter.',
  reply_negotiation_prompt TEXT NOT NULL DEFAULT
    'When a brand replies asking for rates or media kit, draft a warm, concise reply attaching the 1-page media kit link. Ask whether their main objective for Indonesia is brand awareness or user signups, and offer 3 tiered bundle options (1 Video Starter, 3-Video Growth Bundle, and Full Bundle + 60-Day Paid Ads Usage Rights).',
  dm_template_prompt TEXT NOT NULL DEFAULT
    'Write a casual 2-sentence Instagram/LinkedIn DM directly to the founder referencing the email just sent and sharing one quick angle for introducing their product to an Indonesian audience.',
  telegram_chat_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_settings_updated_at ON public.settings;
CREATE TRIGGER set_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed baris default agar tabel settings memiliki data awal
INSERT INTO public.settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy akses penuh untuk client autentikasi / public read-write jika menggunakan anon key lokal
CREATE POLICY "Allow public all access on brands"
  ON public.brands FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public all access on settings"
  ON public.settings FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
