create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('child', 'parent', 'investor')),
  display_name text,
  goal text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists goal text;

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

create policy "read chat messages scoped" on public.chat_messages for select using (
  room_id = 'global'
  or public.chat_is_dm_participant(room_id, auth.uid())
);

create policy "insert chat messages scoped" on public.chat_messages for insert with check (
  auth.role() = 'authenticated'
  and sender_id = auth.uid()
  and (
    room_id = 'global'
    or public.chat_is_dm_participant(room_id, auth.uid())
  )
);

-- タイムライン投稿（インスタ風フィード）
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  caption text not null default '',
  image_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;

create policy "read posts" on public.posts for select using (true);
create policy "insert own posts" on public.posts for insert with check (auth.uid() = author_id);
create policy "delete own posts" on public.posts for delete using (auth.uid() = author_id);

create policy "read post likes" on public.post_likes for select using (true);
create policy "insert own post likes" on public.post_likes for insert with check (auth.uid() = user_id);
create policy "delete own post likes" on public.post_likes for delete using (auth.uid() = user_id);

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

-- 任意: Dashboard → Database → Replication で posts / post_likes を有効にすると他ユーザーの投稿がリアルタイムで反映されます。
