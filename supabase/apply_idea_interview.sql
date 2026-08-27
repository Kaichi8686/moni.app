-- AIビジネスアイデア発掘インタビュー（任意の永続化用）
-- 現状のデモは localStorage で十分動く。
-- ログインユーザーの履歴をサーバー保存したくなったらこの SQL を適用する。

create table if not exists public.idea_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  theme text,
  phase text not null default 'intro',
  messages jsonb not null default '[]'::jsonb,
  seeds jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idea_interview_sessions_user_idx
  on public.idea_interview_sessions (user_id, updated_at desc);

alter table public.idea_interview_sessions enable row level security;

drop policy if exists "own idea interview select" on public.idea_interview_sessions;
drop policy if exists "own idea interview insert" on public.idea_interview_sessions;
drop policy if exists "own idea interview update" on public.idea_interview_sessions;
drop policy if exists "own idea interview delete" on public.idea_interview_sessions;

create policy "own idea interview select" on public.idea_interview_sessions
  for select using (auth.uid() = user_id);
create policy "own idea interview insert" on public.idea_interview_sessions
  for insert with check (auth.uid() = user_id);
create policy "own idea interview update" on public.idea_interview_sessions
  for update using (auth.uid() = user_id);
create policy "own idea interview delete" on public.idea_interview_sessions
  for delete using (auth.uid() = user_id);
