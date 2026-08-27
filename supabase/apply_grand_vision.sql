-- グランドビジョン Phase 2〜（Week2 / Month2 基盤）
-- apply_user_gamification.sql の後に実行

-- プロフィール拡張
alter table public.profiles add column if not exists school text;
alter table public.profiles add column if not exists grade text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists skills jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists moni_tier text not null default 'explorer';
alter table public.profiles add column if not exists today_action_json jsonb;
alter table public.profiles add column if not exists weekly_report_json jsonb;

-- 投稿タイプ（成果投稿など）
alter table public.posts add column if not exists post_type text not null default 'normal';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_post_type_check') then
    alter table public.posts add constraint posts_post_type_check
      check (post_type in ('normal', 'achievement', 'question', 'idea'));
  end if;
end $$;

-- 3種リアクション（いいねとは別）
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'idea', 'help')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_reactions enable row level security;
drop policy if exists "post_reactions read all" on public.post_reactions;
create policy "post_reactions read all" on public.post_reactions for select using (true);
drop policy if exists "post_reactions insert own" on public.post_reactions;
create policy "post_reactions insert own" on public.post_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "post_reactions update own" on public.post_reactions;
create policy "post_reactions update own" on public.post_reactions for update using (auth.uid() = user_id);
drop policy if exists "post_reactions delete own" on public.post_reactions;
create policy "post_reactions delete own" on public.post_reactions for delete using (auth.uid() = user_id);

-- スキルマッチング依頼
create table if not exists public.skill_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  skill_name text not null,
  description text,
  duration text not null default '1週間',
  compensation text not null default 'なし（経験・実績として）',
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists skill_requests_status_idx on public.skill_requests (status, created_at desc);

alter table public.skill_requests enable row level security;
drop policy if exists "skill_requests read all" on public.skill_requests;
create policy "skill_requests read all" on public.skill_requests for select using (true);
drop policy if exists "skill_requests insert own" on public.skill_requests;
create policy "skill_requests insert own" on public.skill_requests for insert with check (auth.uid() = requester_id);
drop policy if exists "skill_requests update own" on public.skill_requests;
create policy "skill_requests update own" on public.skill_requests for update using (auth.uid() = requester_id);

-- 機会掲示板
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('contest', 'grant', 'internship', 'event')),
  title text not null,
  organizer text,
  description text,
  prize text,
  deadline timestamptz,
  url text,
  tags text[] not null default '{}',
  is_verified boolean not null default false,
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists opportunities_deadline_idx on public.opportunities (deadline nulls last);

alter table public.opportunities enable row level security;
drop policy if exists "opportunities read all" on public.opportunities;
create policy "opportunities read all" on public.opportunities for select using (true);
drop policy if exists "opportunities insert auth" on public.opportunities;
create policy "opportunities insert auth" on public.opportunities for insert with check (auth.role() = 'authenticated');
drop policy if exists "opportunities update own" on public.opportunities;
create policy "opportunities update own" on public.opportunities for update using (auth.uid() = submitted_by);

-- メンター
create table if not exists public.mentors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  expertise text[] not null default '{}',
  bio text,
  session_type text not null default 'free' check (session_type in ('free', 'paid', 'application')),
  price_per_30min integer not null default 0,
  availability text not null default 'by_request',
  is_active boolean not null default true,
  rating numeric(3, 2) not null default 0,
  session_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentors (id) on delete cascade,
  mentee_id uuid not null references auth.users (id) on delete cascade,
  scheduled_at timestamptz,
  duration_min integer not null default 30,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'done', 'cancelled')),
  notes text,
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  created_at timestamptz not null default now()
);

alter table public.mentors enable row level security;
alter table public.mentor_sessions enable row level security;

drop policy if exists "mentors read active" on public.mentors;
create policy "mentors read active" on public.mentors for select using (is_active = true or auth.uid() = user_id);
drop policy if exists "mentors insert own" on public.mentors;
create policy "mentors insert own" on public.mentors for insert with check (auth.uid() = user_id);
drop policy if exists "mentors update own" on public.mentors;
create policy "mentors update own" on public.mentors for update using (auth.uid() = user_id);

drop policy if exists "mentor_sessions read involved" on public.mentor_sessions;
create policy "mentor_sessions read involved" on public.mentor_sessions for select using (
  auth.uid() = mentee_id
  or auth.uid() in (select user_id from public.mentors m where m.id = mentor_id)
);
drop policy if exists "mentor_sessions insert mentee" on public.mentor_sessions;
create policy "mentor_sessions insert mentee" on public.mentor_sessions for insert with check (auth.uid() = mentee_id);

-- プロジェクトチーム活動ログ
create table if not exists public.project_activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('task_done', 'issue_done', 'comment', 'phase', 'member')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_activity_events_project_idx
  on public.project_activity_events (project_id, created_at desc);

alter table public.project_activity_events enable row level security;

drop policy if exists "project_activity read members" on public.project_activity_events;
create policy "project_activity read members" on public.project_activity_events for select using (
  exists (
    select 1 from public.project_members pm
    where pm.project_id = project_activity_events.project_id and pm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.projects p
    where p.id = project_activity_events.project_id and p.owner_id = auth.uid()
  )
);

drop policy if exists "project_activity insert members" on public.project_activity_events;
create policy "project_activity insert members" on public.project_activity_events for insert with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_activity_events.project_id and pm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      where p.id = project_activity_events.project_id and p.owner_id = auth.uid()
    )
  )
);
