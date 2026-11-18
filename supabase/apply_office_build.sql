-- オフィス：売上方程式ビルド（カード / コンボ / 社員 / 用語 / 事件 / runs）
-- 冪等。旧 incidents/submissions/meters は DROP しない。

-- ========== companies 拡張 ==========
alter table public.office_companies
  add column if not exists coins integer not null default 0;

alter table public.office_companies
  drop constraint if exists office_companies_coins_nonneg;
alter table public.office_companies
  add constraint office_companies_coins_nonneg check (coins >= 0);

alter table public.office_companies
  add column if not exists mood text not null default 'good';

alter table public.office_companies
  drop constraint if exists office_companies_mood_check;
alter table public.office_companies
  add constraint office_companies_mood_check
  check (mood in ('great', 'good', 'low', 'crisis'));

alter table public.office_companies
  add column if not exists mood_updated_at timestamptz;

alter table public.office_companies
  add column if not exists streak integer not null default 0;

alter table public.office_companies
  drop constraint if exists office_companies_streak_nonneg;
alter table public.office_companies
  add constraint office_companies_streak_nonneg check (streak >= 0);

alter table public.office_companies
  add column if not exists owner_name text;

alter table public.office_companies
  drop constraint if exists office_companies_owner_name_len;
alter table public.office_companies
  add constraint office_companies_owner_name_len
  check (owner_name is null or (char_length(owner_name) between 1 and 12));

alter table public.office_companies
  add column if not exists tutorial_done boolean not null default false;

-- ========== cards ==========
create table if not exists public.office_cards (
  id text primary key,
  name text not null,
  term text,
  cost smallint not null check (cost between 0 and 3),
  tags text[] not null default '{}',
  effect jsonb not null default '{}'::jsonb,
  text text not null default '',
  rarity text not null default 'common'
    check (rarity in ('common', 'rare', 'epic')),
  unlock_level integer not null default 1 check (unlock_level >= 1)
);

-- ========== combos ==========
create table if not exists public.office_combos (
  id text primary key,
  name text not null,
  match jsonb not null,
  bonus_mult numeric not null check (bonus_mult > 0),
  term_id text
);

-- ========== employees ==========
create table if not exists public.office_employees (
  id text primary key,
  name text not null,
  role text not null,
  passive jsonb not null default '{}'::jsonb,
  price integer not null check (price >= 0)
);

-- ========== terms ==========
create table if not exists public.office_terms (
  id text primary key,
  name text not null,
  short_desc text not null,
  formula text,
  unlock_by text
);

-- ========== events (マスター事件) ==========
create table if not exists public.office_events (
  id text primary key,
  industry text,
  type text not null check (type in ('pinch', 'chance', 'people', 'rival')),
  title text not null,
  scene text not null,
  size smallint not null default 2 check (size between 1 and 3),
  base_customers integer not null check (base_customers > 0),
  base_price integer not null check (base_price > 0),
  norma integer not null check (norma > 0),
  data_chips jsonb not null,
  hypotheses jsonb not null,
  weak_tags text[] not null default '{}',
  intro_beats jsonb not null default '[]'::jsonb,
  coach jsonb not null default '{}'::jsonb
);

-- ========== 所持 ==========
create table if not exists public.office_user_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.office_companies (id) on delete cascade,
  card_id text not null references public.office_cards (id) on delete cascade,
  qty integer not null default 1 check (qty >= 1),
  primary key (user_id, card_id)
);

create table if not exists public.office_user_employees (
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.office_companies (id) on delete cascade,
  employee_id text not null references public.office_employees (id) on delete cascade,
  primary key (user_id, employee_id)
);

create table if not exists public.office_user_terms (
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.office_companies (id) on delete cascade,
  term_id text not null references public.office_terms (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

-- ========== runs ==========
create table if not exists public.office_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.office_companies (id) on delete cascade,
  mode text not null check (mode in ('daily', 'free')),
  date_key text not null,
  event_id text not null references public.office_events (id),
  hand jsonb not null default '[]'::jsonb,
  hypothesis_id text,
  played_card_ids jsonb,
  adlib_text text,
  adlib_mult numeric,
  customers integer,
  price integer,
  mult numeric,
  revenue integer,
  ratio numeric,
  rank text check (rank is null or rank in ('S', 'A', 'B', 'C')),
  coins integer,
  trigger_log jsonb,
  mood_before text,
  mood_after text,
  status text not null default 'started'
    check (status in ('started', 'diagnosed', 'finished', 'expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists office_runs_daily_one_per_user_day
  on public.office_runs (user_id, date_key)
  where (mode = 'daily');

create index if not exists idx_office_runs_user_created
  on public.office_runs (user_id, created_at desc);

create index if not exists idx_office_runs_daily_revenue
  on public.office_runs (date_key, mode, status, revenue desc);

-- ========== 日次ランキング用集計ビュー ==========
create or replace view public.office_daily_ranking_public as
select
  r.date_key,
  c.name as company_name,
  c.mood,
  r.revenue,
  r.rank as run_rank,
  r.user_id,
  rank() over (partition by r.date_key order by r.revenue desc, r.finished_at asc) as place
from public.office_runs r
join public.office_companies c on c.user_id = r.user_id
where r.mode = 'daily'
  and r.status = 'finished'
  and c.ranking_enabled = true
  and r.revenue is not null;

-- 月間公開ビューに mood を足す（再定義）
create or replace view public.office_ranking_public as
select
  s.season_key,
  s.league_id,
  s.rank,
  c.name as company_name,
  c.mood,
  s.revenue,
  s.user_id
from public.office_season_scores s
join public.office_companies c on c.user_id = s.user_id
where c.ranking_enabled = true
  and s.rank is not null;

-- ========== RLS ==========
alter table public.office_cards enable row level security;
alter table public.office_combos enable row level security;
alter table public.office_employees enable row level security;
alter table public.office_terms enable row level security;
alter table public.office_events enable row level security;
alter table public.office_user_cards enable row level security;
alter table public.office_user_employees enable row level security;
alter table public.office_user_terms enable row level security;
alter table public.office_runs enable row level security;

-- マスタは認証ユーザー読み取り可
drop policy if exists office_cards_read on public.office_cards;
create policy office_cards_read on public.office_cards
  for select to authenticated using (true);

drop policy if exists office_combos_read on public.office_combos;
create policy office_combos_read on public.office_combos
  for select to authenticated using (true);

drop policy if exists office_employees_read on public.office_employees;
create policy office_employees_read on public.office_employees
  for select to authenticated using (true);

drop policy if exists office_terms_read on public.office_terms;
create policy office_terms_read on public.office_terms
  for select to authenticated using (true);

drop policy if exists office_events_read on public.office_events;
create policy office_events_read on public.office_events
  for select to authenticated using (true);

drop policy if exists office_user_cards_own on public.office_user_cards;
create policy office_user_cards_own on public.office_user_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists office_user_employees_own on public.office_user_employees;
create policy office_user_employees_own on public.office_user_employees
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists office_user_terms_own on public.office_user_terms;
create policy office_user_terms_own on public.office_user_terms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists office_runs_own on public.office_runs;
create policy office_runs_own on public.office_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- サービスロール経由の書き込みは API 側（admin）を想定
