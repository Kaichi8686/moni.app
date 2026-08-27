-- マイブック（個人日記）— Supabase SQL Editor で1回実行（何度実行しても安全）

create table if not exists public.my_book_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null default (timezone('Asia/Tokyo', now()))::date,
  title text not null default '',
  body text not null default '',
  mood text,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists my_book_entries_user_date_idx
  on public.my_book_entries (user_id, entry_date desc);

alter table public.my_book_entries enable row level security;

drop policy if exists "my book select own" on public.my_book_entries;
create policy "my book select own"
  on public.my_book_entries for select
  using (auth.uid() = user_id);

drop policy if exists "my book insert own" on public.my_book_entries;
create policy "my book insert own"
  on public.my_book_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "my book update own" on public.my_book_entries;
create policy "my book update own"
  on public.my_book_entries for update
  using (auth.uid() = user_id);

drop policy if exists "my book delete own" on public.my_book_entries;
create policy "my book delete own"
  on public.my_book_entries for delete
  using (auth.uid() = user_id);
