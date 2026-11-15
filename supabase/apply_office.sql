-- オフィス（社長シミュレーション）
-- 冪等: 何度適用しても安全
-- 旧 idea_league_* テーブルは一切 DROP しない（復元用に保持）

-- 会社
create table if not exists public.office_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  total_revenue integer not null default 0 check (total_revenue >= 0),
  level integer not null default 1 check (level >= 1),
  ranking_enabled boolean not null default true,
  stamina integer not null default 5 check (stamina between 0 and 5),
  stamina_updated_at timestamptz not null default now(),
  league_id text not null default 'rookie'
    check (league_id in ('rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond')),
  created_at timestamptz not null default now()
);

create index if not exists idx_office_companies_league
  on public.office_companies (league_id, ranking_enabled);

-- 事件（ユーザーごとに open は同時1件）
create table if not exists public.office_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.office_companies (id) on delete cascade,
  title text not null,
  description text not null,
  type text not null check (type in ('pinch', 'chance', 'people', 'rival')),
  size smallint not null check (size between 1 and 3),
  status text not null default 'open' check (status in ('open', 'solved')),
  created_at timestamptz not null default now()
);

create unique index if not exists office_incidents_one_open_per_user
  on public.office_incidents (user_id) where (status = 'open');

create index if not exists idx_office_incidents_company
  on public.office_incidents (company_id, created_at desc);

-- 提出
create table if not exists public.office_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.office_companies (id) on delete cascade,
  incident_id uuid not null unique references public.office_incidents (id) on delete cascade,
  answer text not null check (char_length(answer) between 5 and 300),
  score_solve integer not null check (score_solve between 0 and 100),
  score_fun integer not null check (score_fun between 0 and 100),
  score_feasible integer not null check (score_feasible between 0 and 100),
  score_total integer not null check (score_total between 0 and 100),
  comment text not null,
  revenue integer not null check (revenue >= 0),
  was_similar boolean not null default false,
  season_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_office_submissions_user_created
  on public.office_submissions (user_id, created_at desc);

create index if not exists idx_office_submissions_season
  on public.office_submissions (season_key, user_id);

-- 月間シーズン成績
create table if not exists public.office_season_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  season_key text not null,
  league_id text not null
    check (league_id in ('rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond')),
  revenue integer not null default 0 check (revenue >= 0),
  rank integer,
  result text check (result is null or result in ('promoted', 'demoted', 'stayed')),
  result_seen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, season_key)
);

create index if not exists idx_office_season_scores_league
  on public.office_season_scores (season_key, league_id, revenue desc);

-- シーズン締めの冪等ロック
create table if not exists public.office_season_closures (
  season_key text primary key,
  closed_at timestamptz not null default now()
);

-- 公開ランキングビュー（順位・会社名・売上のみ）
create or replace view public.office_ranking_public as
select
  s.season_key,
  s.league_id,
  s.rank,
  c.name as company_name,
  s.revenue,
  s.user_id
from public.office_season_scores s
join public.office_companies c on c.user_id = s.user_id
where c.ranking_enabled = true
  and s.rank is not null;

-- RLS
alter table public.office_companies enable row level security;
alter table public.office_incidents enable row level security;
alter table public.office_submissions enable row level security;
alter table public.office_season_scores enable row level security;
alter table public.office_season_closures enable row level security;

drop policy if exists office_companies_own on public.office_companies;
create policy office_companies_own on public.office_companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists office_incidents_own on public.office_incidents;
create policy office_incidents_own on public.office_incidents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists office_submissions_own on public.office_submissions;
create policy office_submissions_own on public.office_submissions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists office_season_scores_own on public.office_season_scores;
create policy office_season_scores_own on public.office_season_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- closures はクライアント読み取り不要（cron / service role のみ）
drop policy if exists office_season_closures_deny on public.office_season_closures;
create policy office_season_closures_deny on public.office_season_closures
  for select using (false);

-- ランキング公開ビュー用: season_scores の他ユーザー行は RPC/ビュー経由を想定。
-- authenticated が公開ランキングを読むためのポリシー（必要最小限の列はビュー側）
drop policy if exists office_season_scores_ranking_read on public.office_season_scores;
create policy office_season_scores_ranking_read on public.office_season_scores
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.office_companies c
      where c.user_id = office_season_scores.user_id
        and c.ranking_enabled = true
    )
  );

-- 原子的スタミナ消費（現在値を計算してから減らす）
create or replace function public.office_consume_stamina(p_user_id uuid, p_now timestamptz default now())
returns table (ok boolean, stamina integer, stamina_updated_at timestamptz, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stamina integer;
  v_updated timestamptz;
  v_elapsed_ms bigint;
  v_gained integer;
  v_current integer;
  v_new_updated timestamptz;
  recover_ms constant bigint := 30 * 60 * 1000;
  max_stamina constant integer := 5;
begin
  select c.stamina, c.stamina_updated_at into v_stamina, v_updated
  from public.office_companies c
  where c.user_id = p_user_id
  for update;

  if not found then
    return query select false, 0, p_now, 'company_not_found'::text;
    return;
  end if;

  v_current := v_stamina;
  v_new_updated := v_updated;
  if v_stamina < max_stamina then
    v_elapsed_ms := (extract(epoch from (p_now - v_updated)) * 1000)::bigint;
    if v_elapsed_ms > 0 then
      v_gained := (v_elapsed_ms / recover_ms)::integer;
      if v_gained > 0 then
        v_current := least(max_stamina, v_stamina + v_gained);
        if v_current >= max_stamina then
          v_new_updated := p_now;
        else
          v_new_updated := v_updated + make_interval(secs => (v_gained * recover_ms) / 1000.0);
        end if;
      end if;
    end if;
  else
    v_current := max_stamina;
    v_new_updated := p_now;
  end if;

  if v_current < 1 then
    update public.office_companies
      set stamina = v_current, stamina_updated_at = v_new_updated
      where user_id = p_user_id;
    return query select false, v_current, v_new_updated, 'no_stamina'::text;
    return;
  end if;

  v_current := v_current - 1;
  if v_current >= max_stamina then
    v_new_updated := p_now;
  elsif v_stamina >= max_stamina then
    -- 満タンから消費した直後は回復タイマー開始
    v_new_updated := p_now;
  end if;

  update public.office_companies
    set stamina = v_current, stamina_updated_at = v_new_updated
    where user_id = p_user_id;

  return query select true, v_current, v_new_updated, null::text;
end;
$$;

create or replace function public.office_restore_stamina(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stamina integer;
  v_updated timestamptz;
begin
  select stamina, stamina_updated_at into v_stamina, v_updated
  from public.office_companies
  where user_id = p_user_id
  for update;
  if not found then return; end if;
  update public.office_companies
    set stamina = least(5, v_stamina + 1),
        stamina_updated_at = case when v_stamina + 1 >= 5 then now() else v_updated end
    where user_id = p_user_id;
end;
$$;

revoke all on function public.office_consume_stamina(uuid, timestamptz) from public;
revoke all on function public.office_restore_stamina(uuid) from public;
grant execute on function public.office_consume_stamina(uuid, timestamptz) to service_role;
grant execute on function public.office_restore_stamina(uuid) to service_role;
