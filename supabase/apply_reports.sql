-- ユーザー／コンテンツ通報
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  excerpt text,
  reporter_id uuid references auth.users (id) on delete set null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);

alter table public.reports enable row level security;

drop policy if exists "insert own report" on public.reports;
create policy "insert own report" on public.reports
  for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports
  for select
  using (auth.uid() = reporter_id);
