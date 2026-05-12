create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (follower_id, following_id)
);

alter table public.follow_requests enable row level security;

drop policy if exists "read own follow requests" on public.follow_requests;
drop policy if exists "insert own follow requests" on public.follow_requests;
drop policy if exists "update own incoming follow requests" on public.follow_requests;
drop policy if exists "delete own pending follow requests" on public.follow_requests;

create policy "read own follow requests" on public.follow_requests for select using (
  auth.uid() = follower_id or auth.uid() = following_id
);

create policy "insert own follow requests" on public.follow_requests for insert with check (
  auth.uid() = follower_id and status = 'pending'
);

create policy "update own incoming follow requests" on public.follow_requests for update using (
  auth.uid() = following_id
);

create policy "delete own pending follow requests" on public.follow_requests for delete using (
  auth.uid() = follower_id and status = 'pending'
);
