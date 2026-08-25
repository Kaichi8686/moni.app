create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('child', 'parent', 'investor')),
  display_name text,
  goal text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  title text not null,
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table if not exists public.pitches (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  title text not null,
  body text not null,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users (id) on delete set null,
  sender_name text not null,
  body text not null,
  room_id text not null default 'global',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  room_id text not null default 'global',
  last_read_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

alter table public.profiles enable row level security;
alter table public.articles enable row level security;
alter table public.pitches enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

create policy "read profiles" on public.profiles for select using (true);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create policy "read articles" on public.articles for select using (true);
create policy "insert articles auth users" on public.articles for insert with check (auth.role() = 'authenticated');
create policy "update articles auth users" on public.articles for update using (auth.role() = 'authenticated');

create policy "read pitches" on public.pitches for select using (true);
create policy "insert pitches auth users" on public.pitches for insert with check (auth.role() = 'authenticated');
create policy "update pitches auth users" on public.pitches for update using (auth.role() = 'authenticated');

create policy "read chat messages" on public.chat_messages for select using (true);
create policy "insert chat auth users" on public.chat_messages for insert with check (auth.role() = 'authenticated');

create policy "read own chat reads" on public.chat_reads for select using (auth.uid() = user_id);
create policy "upsert own chat reads" on public.chat_reads for insert with check (auth.uid() = user_id);
create policy "update own chat reads" on public.chat_reads for update using (auth.uid() = user_id);

-- DM トーク（マッチングからつながった1対1）。room_id は dm|uuid|uuid（辞書順で2ユーザーを固定）
create table if not exists public.chat_dm_rooms (
  room_id text primary key,
  peer_a uuid not null references auth.users (id) on delete cascade,
  peer_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chat_dm_peers_ordered check (peer_a::text < peer_b::text)
);

alter table public.chat_dm_rooms enable row level security;

create policy "read own dm rooms" on public.chat_dm_rooms for select using (auth.uid() = peer_a or auth.uid() = peer_b);
create policy "insert dm room as participant" on public.chat_dm_rooms for insert with check (auth.uid() = peer_a or auth.uid() = peer_b);

-- グループトーク（room_id = group|...）。現状は作成者のみメンバー扱い。
create table if not exists public.chat_group_rooms (
  room_id text primary key,
  room_name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.chat_group_rooms enable row level security;

drop policy if exists "read own group rooms" on public.chat_group_rooms;
drop policy if exists "insert own group rooms" on public.chat_group_rooms;
drop policy if exists "delete own group rooms" on public.chat_group_rooms;

create policy "read own group rooms" on public.chat_group_rooms for select using (auth.uid() = owner_id);
create policy "insert own group rooms" on public.chat_group_rooms for insert with check (auth.uid() = owner_id);
create policy "delete own group rooms" on public.chat_group_rooms for delete using (auth.uid() = owner_id);

-- グループルームに参加しているか（作成者のみ）
create or replace function public.chat_is_group_participant(p_room_id text, p_uid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_room_id like 'group|%'
    and exists (
      select 1 from public.chat_group_rooms g
      where g.room_id = p_room_id
        and g.owner_id = p_uid
    );
$$;

-- DM ルームに参加しているか（room_id = dm|uid|uid）
create or replace function public.chat_is_dm_participant(p_room_id text, p_uid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    p_room_id like 'dm|%|%'
    and (
      split_part(p_room_id, '|', 2) = p_uid::text
      or split_part(p_room_id, '|', 3) = p_uid::text
    );
$$;

drop policy if exists "read chat messages" on public.chat_messages;
drop policy if exists "insert chat auth users" on public.chat_messages;
drop policy if exists "read chat messages scoped" on public.chat_messages;
drop policy if exists "insert chat messages scoped" on public.chat_messages;

create policy "read chat messages scoped" on public.chat_messages for select using (
  room_id = 'global'
  or public.chat_is_dm_participant(room_id, auth.uid())
  or public.chat_is_group_participant(room_id, auth.uid())
);

create policy "insert chat messages scoped" on public.chat_messages for insert with check (
  auth.role() = 'authenticated'
  and sender_id = auth.uid()
  and (
    room_id = 'global'
    or public.chat_is_dm_participant(room_id, auth.uid())
    or public.chat_is_group_participant(room_id, auth.uid())
  )
);

-- AIメンター（PC/スマホで会話同期用）
create table if not exists public.mentor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

alter table public.mentor_conversations enable row level security;

create policy "read own mentor conversations" on public.mentor_conversations for select using (
  user_id = auth.uid()
);

create policy "insert own mentor conversations" on public.mentor_conversations for insert with check (
  user_id = auth.uid()
);

create policy "update own mentor conversations" on public.mentor_conversations for update using (
  user_id = auth.uid()
);

create table if not exists public.mentor_chat_messages (
  -- フロントが作るユニーク文字列ID（重複しない想定）
  id text primary key,
  conversation_id uuid not null references public.mentor_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.mentor_chat_messages enable row level security;

create policy "read own mentor chat messages" on public.mentor_chat_messages for select using (
  exists (
    select 1
    from public.mentor_conversations c
    where c.id = mentor_chat_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "insert own mentor chat messages" on public.mentor_chat_messages for insert with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.mentor_conversations c
    where c.id = mentor_chat_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

-- タイムライン投稿（インスタ風フィード）
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  caption text not null default '',
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.posts alter column image_path drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_caption_or_image'
  ) then
    alter table public.posts
      add constraint posts_caption_or_image
      check (length(btrim(caption)) > 0 or image_path is not null);
  end if;
end $$;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy "read posts" on public.posts for select using (true);
create policy "insert own posts" on public.posts for insert with check (auth.uid() = author_id);
create policy "delete own posts" on public.posts for delete using (auth.uid() = author_id);

create policy "read post likes" on public.post_likes for select using (true);
create policy "insert own post likes" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "delete own post likes" on public.post_likes for delete using (auth.uid() = user_id);

create policy "read post comments" on public.post_comments for select using (true);
create policy "insert own post comments" on public.post_comments for insert with check (auth.uid() = author_id);
create policy "delete own post comments" on public.post_comments for delete using (auth.uid() = author_id);

-- フォロー機能（Instagram 風）
create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

alter table public.follows enable row level security;

create policy "read follows" on public.follows for select using (true);
create policy "insert own follows" on public.follows for insert with check (auth.uid() = follower_id);
-- 承認フロー: following 側が pending の follow_requests に対応する行を INSERT する
create policy "insert follows when approving follow request" on public.follows for insert with check (
  auth.uid() = following_id
  and exists (
    select 1
    from public.follow_requests fr
    where fr.follower_id = follower_id
      and fr.following_id = following_id
      and fr.status = 'pending'
  )
);
create policy "delete own follows" on public.follows for delete using (auth.uid() = follower_id);

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

alter table public.projects add column if not exists business_type text check (business_type in ('maker', 'software', 'social'));

-- 画像バケット（公開読み取り・自分のフォルダにのみアップロード）
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "post images public read" on storage.objects for select using (bucket_id = 'post-images');

create policy "post images insert own folder" on storage.objects for insert with check (
  bucket_id = 'post-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "post images update own folder" on storage.objects for update using (
  bucket_id = 'post-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "post images delete own folder" on storage.objects for delete using (
  bucket_id = 'post-images'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- アイデア知恵袋（質問・回答・質問者がベストアンサーを決定）
create table if not exists public.idea_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_display_name text not null,
  title text not null check (length(btrim(title)) > 0),
  body text not null default '',
  best_answer_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.idea_questions (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_display_name text not null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'idea_questions_best_answer_fkey') then
    alter table public.idea_questions
      add constraint idea_questions_best_answer_fkey
      foreign key (best_answer_id) references public.idea_answers (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

alter table public.idea_questions enable row level security;
alter table public.idea_answers enable row level security;

drop policy if exists "read idea questions all" on public.idea_questions;
drop policy if exists "insert own idea questions" on public.idea_questions;
drop policy if exists "update own idea questions" on public.idea_questions;

create policy "read idea questions all" on public.idea_questions for select using (true);
create policy "insert own idea questions" on public.idea_questions for insert with check (
  auth.role() = 'authenticated' and auth.uid() = author_id
);
create policy "update own idea questions" on public.idea_questions for update using (auth.uid() = author_id);

drop policy if exists "read idea answers all" on public.idea_answers;
drop policy if exists "insert own idea answers" on public.idea_answers;
drop policy if exists "delete own idea answers" on public.idea_answers;

create policy "read idea answers all" on public.idea_answers for select using (true);
create policy "insert own idea answers" on public.idea_answers for insert with check (
  auth.role() = 'authenticated' and auth.uid() = author_id
);
create policy "delete own idea answers" on public.idea_answers for delete using (auth.uid() = author_id);

-- 7日ビジネス種チャレンジ（壁打ち→ロードマップ→行動ログ）
create table if not exists public.business_seed_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  interests text not null default '',
  brainstorm_step smallint not null default 0 check (brainstorm_step >= 0 and brainstorm_step <= 7),
  messages jsonb not null default '[]'::jsonb,
  finalized_idea text,
  roadmap_days jsonb,
  active_challenge_day smallint not null default 1 check (active_challenge_day >= 1 and active_challenge_day <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_seed_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.business_seed_projects (id) on delete set null,
  log_date date not null default (timezone('utc', now()))::date,
  did_text text not null default '',
  insight_text text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists business_seed_projects_user_idx on public.business_seed_projects (user_id);
create index if not exists business_seed_logs_user_date_idx on public.business_seed_logs (user_id, log_date desc);

alter table public.business_seed_projects enable row level security;
alter table public.business_seed_logs enable row level security;

drop policy if exists "read own business seed projects" on public.business_seed_projects;
drop policy if exists "insert own business seed projects" on public.business_seed_projects;
drop policy if exists "update own business seed projects" on public.business_seed_projects;
drop policy if exists "delete own business seed projects" on public.business_seed_projects;

create policy "read own business seed projects" on public.business_seed_projects for select using (auth.uid() = user_id);
create policy "insert own business seed projects" on public.business_seed_projects for insert with check (auth.uid() = user_id);
create policy "update own business seed projects" on public.business_seed_projects for update using (auth.uid() = user_id);
create policy "delete own business seed projects" on public.business_seed_projects for delete using (auth.uid() = user_id);

drop policy if exists "read own business seed logs" on public.business_seed_logs;
drop policy if exists "insert own business seed logs" on public.business_seed_logs;
drop policy if exists "delete own business seed logs" on public.business_seed_logs;

create policy "read own business seed logs" on public.business_seed_logs for select using (auth.uid() = user_id);
create policy "insert own business seed logs" on public.business_seed_logs for insert with check (auth.uid() = user_id);
create policy "delete own business seed logs" on public.business_seed_logs for delete using (auth.uid() = user_id);

-- 任意: Dashboard → Database → Replication で posts / post_likes を有効にすると他ユーザーの投稿がリアルタイムで反映されます。
