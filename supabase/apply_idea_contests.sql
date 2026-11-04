-- レガシー: ロードマップ応募版。新規は apply_contest_ideas_free_format.sql を使ってください。
-- アイデアコンテスト（悩み課題 × 解決ロードマップ応募）
-- 依存: auth.users, public.profiles（任意）, public.projects（任意・既存RM転用）

-- コンテスト提出用の軽量ロードマップ（プロジェクト phases のスナップショット可）
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  steps jsonb not null default '[]'::jsonb,
  source_project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  why_text text,
  reward_text text,
  prompt_hint text,
  category text not null default 'general',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'active' check (status in ('upcoming', 'active', 'ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  comment varchar(140),
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  unique (contest_id, roadmap_id)
);

create table if not exists public.contest_entry_likes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.contest_entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entry_id, user_id)
);

create index if not exists idx_roadmaps_user on public.roadmaps (user_id, created_at desc);
create index if not exists idx_contests_status_end on public.contests (status, end_at desc);
create index if not exists idx_contest_entries_contest_likes on public.contest_entries (contest_id, like_count desc, created_at desc);
create index if not exists idx_contest_entries_user on public.contest_entries (user_id, created_at desc);
create index if not exists idx_contest_entry_likes_entry on public.contest_entry_likes (entry_id);

-- like_count 同期
create or replace function public.contest_entry_likes_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.contest_entries
      set like_count = like_count + 1
      where id = new.entry_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.contest_entries
      set like_count = greatest(like_count - 1, 0)
      where id = old.entry_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_contest_entry_likes_sync on public.contest_entry_likes;
create trigger trg_contest_entry_likes_sync
  after insert or delete on public.contest_entry_likes
  for each row execute function public.contest_entry_likes_sync();

alter table public.roadmaps enable row level security;
alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
alter table public.contest_entry_likes enable row level security;

-- contests: 認証ユーザーは閲覧可（運営投入想定）
drop policy if exists "contests read authenticated" on public.contests;
create policy "contests read authenticated" on public.contests
  for select to authenticated using (true);

-- roadmaps
drop policy if exists "roadmaps read own or entered" on public.roadmaps;
create policy "roadmaps read own or entered" on public.roadmaps
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.contest_entries e
      where e.roadmap_id = roadmaps.id
    )
  );

drop policy if exists "roadmaps insert own" on public.roadmaps;
create policy "roadmaps insert own" on public.roadmaps
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "roadmaps update own" on public.roadmaps;
create policy "roadmaps update own" on public.roadmaps
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "roadmaps delete own" on public.roadmaps;
create policy "roadmaps delete own" on public.roadmaps
  for delete to authenticated using (user_id = auth.uid());

-- entries
drop policy if exists "contest entries read authenticated" on public.contest_entries;
create policy "contest entries read authenticated" on public.contest_entries
  for select to authenticated using (true);

drop policy if exists "contest entries insert own" on public.contest_entries;
create policy "contest entries insert own" on public.contest_entries
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "contest entries update own" on public.contest_entries;
create policy "contest entries update own" on public.contest_entries
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "contest entries delete own" on public.contest_entries;
create policy "contest entries delete own" on public.contest_entries
  for delete to authenticated using (user_id = auth.uid());

-- likes
drop policy if exists "contest likes read authenticated" on public.contest_entry_likes;
create policy "contest likes read authenticated" on public.contest_entry_likes
  for select to authenticated using (true);

drop policy if exists "contest likes insert own" on public.contest_entry_likes;
create policy "contest likes insert own" on public.contest_entry_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "contest likes delete own" on public.contest_entry_likes;
create policy "contest likes delete own" on public.contest_entry_likes
  for delete to authenticated using (user_id = auth.uid());

-- シード: 開催中のお題（冪等）
insert into public.contests (
  id, title, description, why_text, reward_text, prompt_hint, category, start_at, end_at, status
)
values (
  'a1111111-1111-4111-8111-111111111111',
  '勉強中のスマホ誘惑を断ち切れない問題',
  '集中したいのに通知やSNSで手が伸びてしまう。意志力だけに頼らない、現実的な解決ロードマップを募集します。',
  '学生・社会人どちらも共感が多い「実行の最初の壁」。小さな習慣設計で突破できるお題です。',
  '上位入賞でプロフィール実績バッジ＋コミュニティフィーチャー',
  '勉強中のスマホ誘惑を減らすための、1〜2週間で実行できるステップ型ロードマップ',
  'habits',
  now() - interval '1 day',
  now() + interval '14 days',
  'active'
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  why_text = excluded.why_text,
  reward_text = excluded.reward_text,
  prompt_hint = excluded.prompt_hint,
  status = excluded.status,
  end_at = excluded.end_at;
