-- 7日ビジネス種チャレンジ — Supabase SQL Editor で1回実行

create table if not exists public.business_seed_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  interests text not null default '',
  brainstorm_step smallint not null default 0 check (brainstorm_step >= 0 and brainstorm_step <= 7),
  messages jsonb not null default '[]'::jsonb,
  finalized_idea text,
  roadmap_days jsonb,
  active_challenge_day smallint not null default 1 check (active_challenge_day >= 1 and active_challenge_day <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_seed_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.business_seed_projects (id) on delete set null,
  log_date date not null default (timezone('utc', now()))::date,
  did_text text not null default '',
  insight_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists business_seed_projects_user_idx on public.business_seed_projects (user_id);
create index if not exists business_seed_logs_user_date_idx on public.business_seed_logs (user_id, log_date desc);

alter table public.business_seed_projects enable row level security;
alter table public.business_seed_logs enable row level security;

drop policy if exists "read own business seed projects" on public.business_seed_projects;
drop policy if exists "insert own business seed projects" on public.business_seed_projects;
drop policy if exists "update own business seed projects" on public.business_seed_projects;
drop policy if exists "delete own business seed projects" on public.business_seed_projects;

create policy "read own business seed projects" on public.business_seed_projects for select using (auth.uid() = user_id);
create policy "insert own business seed projects" on public.business_seed_projects for insert with check (auth.uid() = user_id);
create policy "update own business seed projects" on public.business_seed_projects for update using (auth.uid() = user_id);
create policy "delete own business seed projects" on public.business_seed_projects for delete using (auth.uid() = user_id);

drop policy if exists "read own business seed logs" on public.business_seed_logs;
drop policy if exists "insert own business seed logs" on public.business_seed_logs;
drop policy if exists "delete own business seed logs" on public.business_seed_logs;

create policy "read own business seed logs" on public.business_seed_logs for select using (auth.uid() = user_id);
create policy "insert own business seed logs" on public.business_seed_logs for insert with check (auth.uid() = user_id);
create policy "delete own business seed logs" on public.business_seed_logs for delete using (auth.uid() = user_id);
