-- ==============================================================================
-- UPGRADE GELOMBANG 1: Deal Optimization & Deliverability Guard
-- ==============================================================================

-- 1. TAMBAH KOLOM PADA TABEL BRANDS (Aman: ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS has_partner_program BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buying_intent_signals TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_indonesia_accessible BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_variant TEXT CHECK (email_variant IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Indeks baru untuk optimasi kueri analitik & proteksi blacklist
CREATE INDEX IF NOT EXISTS idx_brands_email_variant ON public.brands (email_variant);
CREATE INDEX IF NOT EXISTS idx_brands_do_not_contact ON public.brands (do_not_contact);
CREATE INDEX IF NOT EXISTS idx_brands_replied_at ON public.brands (replied_at);

-- 2. TAMBAH KOLOM PADA TABEL SETTINGS (Singleton id = 1)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS bounces_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_daily_bounces INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS enforce_business_hours BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS active_email_variants TEXT[] NOT NULL DEFAULT ARRAY['A', 'B', 'C'],
  ADD COLUMN IF NOT EXISTS variant_a_prompt TEXT,
  ADD COLUMN IF NOT EXISTS variant_b_prompt TEXT,
  ADD COLUMN IF NOT EXISTS variant_c_prompt TEXT,
  ADD COLUMN IF NOT EXISTS creator_metrics TEXT,
  ADD COLUMN IF NOT EXISTS creator_social_proof TEXT,
  ADD COLUMN IF NOT EXISTS creator_content_style TEXT;

-- 3. ISI NILAI DEFAULT PROMPT & PROOF BANK PADA SETTINGS ROW (id = 1)
UPDATE public.settings
SET
  variant_a_prompt = COALESCE(variant_a_prompt, 
    'Write a concise, high-converting cold email (under 90 words, 3 paragraphs, 0 attachments) using the Direct R.O.P.E. framework to the Partnership/Marketing Manager. Paragraph 1: State an exact feature observation of their product. Paragraph 2: Introduce Adrien Fandra as a top tech/dev Indonesian creator (180k+ young engineers & power users) with 1 tailored content integration idea. Paragraph 3: Low-friction ask for Q1 partnership.'
  ),
  variant_b_prompt = COALESCE(variant_b_prompt, 
    'Write a 3-sentence ultra-short cold email (under 50 words) using The Boss Redirect framework to the Founder/CMO/Head of Growth. Sentence 1: Enthusiastic mention of their product. Sentence 2: Mention 180k+ Indonesian tech audience looking for tools like theirs. Sentence 3: "Who on your team heads Southeast Asia creator or affiliate partnerships so I can send a 1-page deck?"'
  ),
  variant_c_prompt = COALESCE(variant_c_prompt, 
    'Write a concise cold email (under 95 words) using the Problem/Gap Angle. Paragraph 1: Highlight an adoption or education gap for their product among Indonesian developers/freelancers. Paragraph 2: How Adrien Fandra''s logic-first workflow tutorials bridge this gap and drive actual user acquisition. Paragraph 3: Casual ask if they are exploring Indonesian market growth this quarter.'
  ),
  creator_metrics = COALESCE(creator_metrics, 
    'Total Reach: 185,000+ Followers/Subscribers across YouTube & LinkedIn. 30-Day Avg Views: 42,000 per long-form / 85,000 per short. Demographics: 72% Indonesia, 18-34 years old (68% Software Engineers, Tech Freelancers, Remote Workers & Tech Enthusiasts). High purchasing power for productivity software and dev tools.'
  ),
  creator_social_proof = COALESCE(creator_social_proof, 
    'Previous Brand Collaborations: Notion, Wise, Raycast, Supabase community. Proven conversion: 1,400+ signups generated in a single campaign tutorial. 4.8% CTR on partnership links.'
  ),
  creator_content_style = COALESCE(creator_content_style, 
    'Tone & Style: Logic-first, analytical, deep hands-on breakdown, zero fluff, transparent benchmarks, practical workflow architecture, highly trusted by senior engineers and tech professionals.'
  )
WHERE id = 1;
