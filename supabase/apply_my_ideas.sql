-- マイアイデア（ユーザー個人のアイデアメモ）
create table if not exists public.my_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  memo text not null default '',
  source text not null default 'manual'
    check (source in ('manual', 'interview')),
  seed_id text null,
  theme text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists my_ideas_user_created_idx
  on public.my_ideas (user_id, created_at desc);

alter table public.my_ideas enable row level security;

drop policy if exists "own my_ideas select" on public.my_ideas;
drop policy if exists "own my_ideas insert" on public.my_ideas;
drop policy if exists "own my_ideas update" on public.my_ideas;
drop policy if exists "own my_ideas delete" on public.my_ideas;

create policy "own my_ideas select" on public.my_ideas
  for select using (auth.uid() = user_id);
create policy "own my_ideas insert" on public.my_ideas
  for insert with check (auth.uid() = user_id);
create policy "own my_ideas update" on public.my_ideas
  for update using (auth.uid() = user_id);
create policy "own my_ideas delete" on public.my_ideas
  for delete using (auth.uid() = user_id);
