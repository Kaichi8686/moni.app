-- オフィス：場面ステージ体験（cast_members / meters / 事件拡張 / 連鎖 / 図鑑 / 投票 / 通報）
-- 冪等
-- 注意: カラム名 cast は PostgreSQL 予約語のため使わない（cast_members）

-- ========== office_companies ==========
alter table public.office_companies
  add column if not exists cast_members jsonb;

alter table public.office_companies
  add column if not exists meters jsonb;

alter table public.office_companies
  add column if not exists meters_updated_at timestamptz;

alter table public.office_companies
  add column if not exists login_streak integer not null default 0;

alter table public.office_companies
  add column if not exists login_last_date date;

alter table public.office_companies
  add column if not exists rest_ticket_month text;

alter table public.office_companies
  add column if not exists share_opt_out boolean not null default false;

alter table public.office_companies
  add column if not exists sfx_muted boolean not null default true;

alter table public.office_companies
  add column if not exists secretary_guide_done boolean not null default false;

alter table public.office_companies
  drop constraint if exists office_companies_login_streak_check;

alter table public.office_companies
  add constraint office_companies_login_streak_check
  check (login_streak >= 0);

-- ========== office_incidents ==========
alter table public.office_incidents
  add column if not exists scene text;

alter table public.office_incidents
  add column if not exists speaker jsonb;

alter table public.office_incidents
  add column if not exists line text;

alter table public.office_incidents
  add column if not exists stakes text;

alter table public.office_incidents
  add column if not exists meters_at_risk jsonb;

alter table public.office_incidents
  add column if not exists followup_of uuid references public.office_incidents (id) on delete set null;

alter table public.office_incidents
  drop constraint if exists office_incidents_scene_check;

alter table public.office_incidents
  add constraint office_incidents_scene_check
  check (
    scene is null
    or scene in (
      'queue', 'complaint', 'rival', 'viral', 'staff_trouble', 'sold_out',
      'equipment', 'vip', 'rainy', 'sns_fire', 'deadline', 'new_hire'
    )
  );

create index if not exists idx_office_incidents_followup
  on public.office_incidents (followup_of);

-- ========== office_submissions ==========
alter table public.office_submissions
  add column if not exists cast_member_id text;

alter table public.office_submissions
  add column if not exists strategy_title text;

alter table public.office_submissions
  add column if not exists panels jsonb;

alter table public.office_submissions
  add column if not exists npc_line text;

alter table public.office_submissions
  add column if not exists reaction_emotion text;

alter table public.office_submissions
  add column if not exists safe boolean not null default true;

alter table public.office_submissions
  add column if not exists meters_delta jsonb;

alter table public.office_submissions
  drop constraint if exists office_submissions_reaction_emotion_check;

alter table public.office_submissions
  add constraint office_submissions_reaction_emotion_check
  check (
    reaction_emotion is null
    or reaction_emotion in ('happy', 'worried', 'angry', 'panic', 'smug')
  );

create index if not exists idx_office_submissions_peer
  on public.office_submissions (score_total desc, created_at desc)
  where safe = true;

-- ========== office_codex ==========
create table if not exists public.office_codex (
  user_id uuid not null references auth.users (id) on delete cascade,
  scene text not null,
  type text not null check (type in ('pinch', 'chance', 'people', 'rival')),
  first_solved_at timestamptz not null default now(),
  best_score integer not null default 0 check (best_score between 0 and 100),
  primary key (user_id, scene, type),
  check (
    scene in (
      'queue', 'complaint', 'rival', 'viral', 'staff_trouble', 'sold_out',
      'equipment', 'vip', 'rainy', 'sns_fire', 'deadline', 'new_hire'
    )
  )
);

alter table public.office_codex enable row level security;

drop policy if exists office_codex_own on public.office_codex;
create policy office_codex_own on public.office_codex
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ========== office_peer_votes ==========
create table if not exists public.office_peer_votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references auth.users (id) on delete cascade,
  submission_id uuid not null references public.office_submissions (id) on delete cascade,
  day_key text not null,
  created_at timestamptz not null default now(),
  unique (voter_id, submission_id)
);

create index if not exists idx_office_peer_votes_day
  on public.office_peer_votes (voter_id, day_key);

alter table public.office_peer_votes enable row level security;

drop policy if exists office_peer_votes_own on public.office_peer_votes;
create policy office_peer_votes_own on public.office_peer_votes
  for all using (auth.uid() = voter_id) with check (auth.uid() = voter_id);

-- ========== office_peer_reports ==========
create table if not exists public.office_peer_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  submission_id uuid not null references public.office_submissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reporter_id, submission_id)
);

create index if not exists idx_office_peer_reports_submission
  on public.office_peer_reports (submission_id);

alter table public.office_peer_reports enable row level security;

drop policy if exists office_peer_reports_own on public.office_peer_reports;
create policy office_peer_reports_own on public.office_peer_reports
  for insert with check (auth.uid() = reporter_id);

drop policy if exists office_peer_reports_select_own on public.office_peer_reports;
create policy office_peer_reports_select_own on public.office_peer_reports
  for select using (auth.uid() = reporter_id);
