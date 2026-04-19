-- Supabase ダッシュボード → SQL Editor で「一度だけ」実行してください。
-- グループ room_id（group|...）への chat_messages の読み書きが RLS で弾かれている状態を直します。

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
