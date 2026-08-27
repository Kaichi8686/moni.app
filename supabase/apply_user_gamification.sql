-- ユーザーゲーミフィケーション（バッジ・ストリーク・マイルストーン）
-- Supabase SQL Editor で schema.sql / apply_profile_instagram.sql の後に実行

alter table public.profiles add column if not exists activity_streak integer not null default 0;
alter table public.profiles add column if not exists activity_last_date text;
alter table public.profiles add column if not exists activity_log jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists badges jsonb not null default '[]'::jsonb;

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  type text not null,
  title text not null,
  description text,
  image_url text,
  achieved_at timestamptz not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists milestones_user_id_idx on public.milestones (user_id);
create index if not exists milestones_achieved_at_idx on public.milestones (achieved_at desc);

alter table public.milestones enable row level security;

drop policy if exists "milestones select public or own" on public.milestones;
create policy "milestones select public or own"
  on public.milestones for select
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "milestones insert own" on public.milestones;
create policy "milestones insert own"
  on public.milestones for insert
  with check (auth.uid() = user_id);

drop policy if exists "milestones update own" on public.milestones;
create policy "milestones update own"
  on public.milestones for update
  using (auth.uid() = user_id);

drop policy if exists "milestones delete own" on public.milestones;
create policy "milestones delete own"
  on public.milestones for delete
  using (auth.uid() = user_id);
