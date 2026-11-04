-- アイデアコンテスト（自由フォーマット投稿）
-- 既存 apply_idea_contests.sql 適用済みでも冪等で追加できる

-- contests（無ければ作成 / あれば列追加）
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

alter table public.contests add column if not exists why_text text;
alter table public.contests add column if not exists reward_text text;
alter table public.contests add column if not exists prompt_hint text;
alter table public.contests add column if not exists category text default 'general';

-- 任意でロードマップ連携するための軽量テーブル（未作成時のみ）
create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  steps jsonb not null default '[]'::jsonb,
  source_project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.contest_ideas (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  content text not null,
  appeal varchar(140),
  roadmap_id uuid references public.roadmaps (id) on delete set null,
  image_url text,
  external_url text,
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.contest_idea_likes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.contest_ideas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, user_id)
);

create index if not exists idx_contest_ideas_contest_likes
  on public.contest_ideas (contest_id, like_count desc, created_at desc);
create index if not exists idx_contest_ideas_user on public.contest_ideas (user_id, created_at desc);
create index if not exists idx_contest_idea_likes_idea on public.contest_idea_likes (idea_id);

create or replace function public.contest_idea_likes_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.contest_ideas set like_count = like_count + 1 where id = new.idea_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.contest_ideas set like_count = greatest(like_count - 1, 0) where id = old.idea_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_contest_idea_likes_sync on public.contest_idea_likes;
create trigger trg_contest_idea_likes_sync
  after insert or delete on public.contest_idea_likes
  for each row execute function public.contest_idea_likes_sync();

alter table public.contests enable row level security;
alter table public.roadmaps enable row level security;
alter table public.contest_ideas enable row level security;
alter table public.contest_idea_likes enable row level security;

drop policy if exists "contests read authenticated" on public.contests;
create policy "contests read authenticated" on public.contests
  for select to authenticated using (true);

drop policy if exists "roadmaps read own or entered" on public.roadmaps;
create policy "roadmaps read own or entered" on public.roadmaps
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.contest_ideas i where i.roadmap_id = roadmaps.id)
  );

drop policy if exists "roadmaps insert own" on public.roadmaps;
create policy "roadmaps insert own" on public.roadmaps
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "contest ideas read authenticated" on public.contest_ideas;
create policy "contest ideas read authenticated" on public.contest_ideas
  for select to authenticated using (true);

drop policy if exists "contest ideas insert own" on public.contest_ideas;
create policy "contest ideas insert own" on public.contest_ideas
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "contest ideas update own" on public.contest_ideas;
create policy "contest ideas update own" on public.contest_ideas
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "contest ideas delete own" on public.contest_ideas;
create policy "contest ideas delete own" on public.contest_ideas
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "contest idea likes read authenticated" on public.contest_idea_likes;
create policy "contest idea likes read authenticated" on public.contest_idea_likes
  for select to authenticated using (true);

drop policy if exists "contest idea likes insert own" on public.contest_idea_likes;
create policy "contest idea likes insert own" on public.contest_idea_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "contest idea likes delete own" on public.contest_idea_likes;
create policy "contest idea likes delete own" on public.contest_idea_likes
  for delete to authenticated using (user_id = auth.uid());

insert into public.contests (
  id, title, description, why_text, reward_text, prompt_hint, category, start_at, end_at, status
)
values (
  'a1111111-1111-4111-8111-111111111111',
  '勉強中のスマホ誘惑を断ち切れない問題',
  '集中したいのに通知やSNSで手が伸びてしまう。テキスト・スケッチ・プロトタイプURL・ロードマップなど、自由な形で解決アイデアを発表してください。',
  '学生・社会人どちらも共感が多い「実行の最初の壁」。完璧な企画書は不要、ラフでもOKです。',
  '上位入賞でプロフィール実績バッジ＋コミュニティフィーチャー',
  'スマホ誘惑を減らすアイデア（習慣・ツール・環境づくりなど何でも）',
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
