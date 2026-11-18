-- オフィス：会話型事件（台本・ミッション・聞き込み・社長名）
-- 冪等

-- ========== office_companies ==========
alter table public.office_companies
  add column if not exists owner_name text;

alter table public.office_companies
  drop constraint if exists office_companies_owner_name_len;

alter table public.office_companies
  add constraint office_companies_owner_name_len
  check (owner_name is null or (char_length(owner_name) between 1 and 12));

-- ========== office_incidents ==========
alter table public.office_incidents
  add column if not exists script jsonb;

alter table public.office_incidents
  add column if not exists mission jsonb;

alter table public.office_incidents
  add column if not exists questions jsonb;

-- ========== office_submissions ==========
alter table public.office_submissions
  add column if not exists asked_question_ids jsonb;

alter table public.office_submissions
  add column if not exists reaction_lines jsonb;
