import { AppSettings } from '@/types/brand';

export const initialMockSettings: AppSettings = {
  id: 1,
  is_global_paused: false,
  daily_email_limit: 35,
  emails_sent_today: 0,
  min_fit_score: 60,
  followup_1_delay_days: 4,
  followup_2_delay_days: 5,
  fallback_delay_days: 5,
  sender_name: 'Adrien Fandra',
  sender_email: 'adrien@creatoroutbound.co',
  media_kit_pdf_url: 'https://creatoroutbound.co/media-kit-adrien-2026.pdf',
  discovery_keywords: [
    'personal finance app global',
    'AI productivity tool SaaS',
    'fintech investing platform SEA',
    'edtech career platform international',
    'global remote work tools'
  ],
  target_countries: [
    'United States',
    'Singapore',
    'United Kingdom',
    'Germany',
    'Australia',
    'Japan'
  ],
  rope_system_prompt:
    'Write a concise cold email (under 100 words, 3 paragraphs, zero attachments) using the R.O.P.E. framework. Never open with "My name is". Start with a specific observation about the brand, bridge to helping them educate and acquire young Indonesian users, include 1 concrete content concept, and end with a low-friction question asking if they are open to Indonesian creator partnerships this quarter.',
  reply_negotiation_prompt:
    'When a brand replies asking for rates or media kit, draft a warm, concise reply attaching the 1-page media kit link. Ask whether their main objective for Indonesia is brand awareness or user signups, and offer 3 tiered bundle options (1 Video Starter, 3-Video Growth Bundle, and Full Bundle + 60-Day Paid Ads Usage Rights).',
  dm_template_prompt:
    'Write a casual 2-sentence Instagram/LinkedIn DM directly to the founder referencing the email just sent and sharing one quick angle for introducing their product to an Indonesian audience.',
  telegram_chat_id: '@adrienfandra_alerts',
  updated_at: new Date().toISOString(),

  // Wave 1: Deliverability Guard & Proof Bank & Variants
  bounces_today: 0,
  max_daily_bounces: 2,
  enforce_business_hours: true,
  active_email_variants: ['A', 'B', 'C'],
  variant_a_prompt:
    'Write a concise, high-converting cold email (under 90 words, 3 paragraphs, 0 attachments) using the Direct R.O.P.E. framework to the Partnership/Marketing Manager. Paragraph 1: State an exact feature observation of their product. Paragraph 2: Introduce Adrien Fandra as a top tech/dev Indonesian creator (180k+ young engineers & power users) with 1 tailored content integration idea. Paragraph 3: Low-friction ask for Q1 partnership.',
  variant_b_prompt:
    'Write a 3-sentence ultra-short cold email (under 50 words) using The Boss Redirect framework to the Founder/CMO/Head of Growth. Sentence 1: Enthusiastic mention of their product. Sentence 2: Mention 180k+ Indonesian tech audience looking for tools like theirs. Sentence 3: "Who on your team heads Southeast Asia creator or affiliate partnerships so I can send a 1-page deck?"',
  variant_c_prompt:
    'Write a concise cold email (under 95 words) using the Problem/Gap Angle. Paragraph 1: Highlight an adoption or education gap for their product among Indonesian developers/freelancers. Paragraph 2: How Adrien Fandra\'s logic-first workflow tutorials bridge this gap and drive actual user acquisition. Paragraph 3: Casual ask if they are exploring Indonesian market growth this quarter.',
  creator_metrics:
    'Total Reach: 185,000+ Followers/Subscribers across YouTube & LinkedIn. 30-Day Avg Views: 42,000 per long-form / 85,000 per short. Demographics: 72% Indonesia, 18-34 years old (68% Software Engineers, Tech Freelancers, Remote Workers & Tech Enthusiasts). High purchasing power for productivity software and dev tools.',
  creator_social_proof:
    'Previous Brand Collaborations: Notion, Wise, Raycast, Supabase community. Proven conversion: 1,400+ signups generated in a single campaign tutorial. 4.8% CTR on partnership links.',
  creator_content_style:
    'Tone & Style: Logic-first, analytical, deep hands-on breakdown, zero fluff, transparent benchmarks, practical workflow architecture, highly trusted by senior engineers and tech professionals.',
};
