-- アイデアリーグ（毎週土曜日バトル / 昇格 / 投票 / チュートリアル）
-- 冪等: 何度適用しても安全

-- プロフィール拡張
alter table public.profiles
  add column if not exists idea_league_tier text not null default 'bronze';
alter table public.profiles
  add column if not exists idea_league_tutorial_completed_at timestamptz;
alter table public.profiles
  add column if not exists idea_league_promotions integer not null default 0;
alter table public.profiles
  add column if not exists idea_league_highlight boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_idea_league_tier_check'
  ) then
    alter table public.profiles
      add constraint profiles_idea_league_tier_check
      check (idea_league_tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond'));
  end if;
end $$;

-- 週次お題（毎週土 00:00–23:59 Asia/Tokyo 想定）
create table if not exists public.idea_league_weeks (
  id uuid primary key default gen_random_uuid(),
  week_key text not null unique,
  prompt_title text not null,
  prompt_body text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'scoring', 'ended')),
  created_at timestamptz not null default now()
);

-- 同ティア内グループ（Duolingo 風〜20人）
create table if not exists public.idea_league_groups (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.idea_league_weeks (id) on delete cascade,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  group_index integer not null default 0,
  created_at timestamptz not null default now(),
  unique (week_id, tier, group_index)
);

create table if not exists public.idea_league_memberships (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.idea_league_weeks (id) on delete cascade,
  group_id uuid not null references public.idea_league_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  vote_score integer not null default 0,
  rank integer,
  promoted boolean not null default false,
  result_status text not null default 'pending'
    check (result_status in ('pending', 'promoted', 'stayed', 'tutorial')),
  joined_at timestamptz not null default now(),
  unique (week_id, user_id)
);

create index if not exists idx_idea_league_memberships_group
  on public.idea_league_memberships (group_id, vote_score desc, joined_at asc);

create table if not exists public.idea_league_submissions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.idea_league_weeks (id) on delete cascade,
  group_id uuid not null references public.idea_league_groups (id) on delete cascade,
  membership_id uuid not null references public.idea_league_memberships (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  content text not null,
  appeal varchar(140),
  vote_count integer not null default 0 check (vote_count >= 0),
  is_tutorial boolean not null default false,
  created_at timestamptz not null default now(),
  unique (week_id, user_id)
);

create table if not exists public.idea_league_votes (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.idea_league_weeks (id) on delete cascade,
  group_id uuid not null references public.idea_league_groups (id) on delete cascade,
  submission_id uuid not null references public.idea_league_submissions (id) on delete cascade,
  voter_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (week_id, voter_id, submission_id),
  unique (week_id, voter_id)
);

create index if not exists idx_idea_league_votes_submission
  on public.idea_league_votes (submission_id);

create table if not exists public.idea_league_promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_id uuid references public.idea_league_weeks (id) on delete set null,
  from_tier text not null,
  to_tier text not null,
  final_rank integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_idea_league_promotions_user
  on public.idea_league_promotions (user_id, created_at desc);

-- チュートリアル完了記録（profiles 列と併用）
create table if not exists public.idea_league_tutorial_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null,
  mock_rank integer not null default 3,
  completed_at timestamptz not null default now(),
  unique (user_id)
);

-- 投票数同期
create or replace function public.idea_league_votes_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.idea_league_submissions
      set vote_count = vote_count + 1
      where id = new.submission_id;
    update public.idea_league_memberships m
      set vote_score = s.vote_count
      from public.idea_league_submissions s
      where s.id = new.submission_id and m.id = s.membership_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.idea_league_submissions
      set vote_count = greatest(vote_count - 1, 0)
      where id = old.submission_id;
    update public.idea_league_memberships m
      set vote_score = s.vote_count
      from public.idea_league_submissions s
      where s.id = old.submission_id and m.id = s.membership_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_idea_league_votes_sync on public.idea_league_votes;
create trigger trg_idea_league_votes_sync
  after insert or delete on public.idea_league_votes
  for each row execute function public.idea_league_votes_sync();

alter table public.idea_league_weeks enable row level security;
alter table public.idea_league_groups enable row level security;
alter table public.idea_league_memberships enable row level security;
alter table public.idea_league_submissions enable row level security;
alter table public.idea_league_votes enable row level security;
alter table public.idea_league_promotions enable row level security;
alter table public.idea_league_tutorial_runs enable row level security;

drop policy if exists "idea_league_weeks_read" on public.idea_league_weeks;
create policy "idea_league_weeks_read" on public.idea_league_weeks
  for select to authenticated using (true);

drop policy if exists "idea_league_groups_read" on public.idea_league_groups;
create policy "idea_league_groups_read" on public.idea_league_groups
  for select to authenticated using (true);

drop policy if exists "idea_league_memberships_read" on public.idea_league_memberships;
create policy "idea_league_memberships_read" on public.idea_league_memberships
  for select to authenticated using (true);

drop policy if exists "idea_league_memberships_insert_own" on public.idea_league_memberships;
create policy "idea_league_memberships_insert_own" on public.idea_league_memberships
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "idea_league_memberships_update_own" on public.idea_league_memberships;
create policy "idea_league_memberships_update_own" on public.idea_league_memberships
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "idea_league_submissions_read" on public.idea_league_submissions;
create policy "idea_league_submissions_read" on public.idea_league_submissions
  for select to authenticated using (true);

drop policy if exists "idea_league_submissions_insert_own" on public.idea_league_submissions;
create policy "idea_league_submissions_insert_own" on public.idea_league_submissions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "idea_league_submissions_update_own" on public.idea_league_submissions;
create policy "idea_league_submissions_update_own" on public.idea_league_submissions
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "idea_league_votes_read" on public.idea_league_votes;
create policy "idea_league_votes_read" on public.idea_league_votes
  for select to authenticated using (true);

drop policy if exists "idea_league_votes_insert_own" on public.idea_league_votes;
create policy "idea_league_votes_insert_own" on public.idea_league_votes
  for insert to authenticated with check (voter_id = auth.uid());

drop policy if exists "idea_league_votes_delete_own" on public.idea_league_votes;
create policy "idea_league_votes_delete_own" on public.idea_league_votes
  for delete to authenticated using (voter_id = auth.uid());

drop policy if exists "idea_league_promotions_read" on public.idea_league_promotions;
create policy "idea_league_promotions_read" on public.idea_league_promotions
  for select to authenticated using (true);

drop policy if exists "idea_league_tutorial_read_own" on public.idea_league_tutorial_runs;
create policy "idea_league_tutorial_read_own" on public.idea_league_tutorial_runs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "idea_league_tutorial_insert_own" on public.idea_league_tutorial_runs;
create policy "idea_league_tutorial_insert_own" on public.idea_league_tutorial_runs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "idea_league_tutorial_update_own" on public.idea_league_tutorial_runs;
create policy "idea_league_tutorial_update_own" on public.idea_league_tutorial_runs
  for update to authenticated using (user_id = auth.uid());
