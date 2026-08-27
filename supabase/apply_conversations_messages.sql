-- moni メッセージ v2: conversations / messages / reactions
-- Supabase SQL Editor で実行

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group', 'project')),
  name text,
  icon_emoji text default '💬',
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  invite_code text unique,
  created_at timestamptz not null default now()
);

alter table public.conversations add column if not exists invite_code text unique;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  is_muted boolean not null default false,
  is_pinned boolean not null default false,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text,
  content_type text not null default 'text'
    check (content_type in (
      'text', 'image', 'video', 'voice', 'file',
      'collab_request', 'task_card', 'milestone_share', 'system'
    )),
  metadata jsonb not null default '{}'::jsonb,
  reply_to_id uuid references public.messages (id) on delete set null,
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  pinned_at timestamptz,
  pinned_by uuid references auth.users (id) on delete set null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists idx_conversations_last_message on public.conversations (last_message_at desc);
create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at asc);
create index if not exists idx_conversation_members_user on public.conversation_members (user_id);

create index if not exists messages_content_search
  on public.messages using gin (to_tsvector('simple', coalesce(content, '')));

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

-- Helper: member check
create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_conversation_member(uuid) to authenticated;

-- 1対1 DM を取得または作成
create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception 'invalid peer';
  end if;

  select c.id into v_conv_id
  from public.conversations c
  where c.type = 'direct'
    and (
      select count(*)::int from public.conversation_members m
      where m.conversation_id = c.id
    ) = 2
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = v_uid
    )
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = c.id and m.user_id = p_other_user_id
    )
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  insert into public.conversations (type, created_by)
  values ('direct', v_uid)
  returning id into v_conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values
    (v_conv_id, v_uid, 'admin'),
    (v_conv_id, p_other_user_id, 'member');

  return v_conv_id;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- RLS: conversations
drop policy if exists "conversations: members select" on public.conversations;
create policy "conversations: members select" on public.conversations
  for select using (public.is_conversation_member(id));

drop policy if exists "conversations: authenticated insert" on public.conversations;
create policy "conversations: authenticated insert" on public.conversations
  for insert with check (auth.uid() = created_by);

drop policy if exists "conversations: admin update" on public.conversations;
create policy "conversations: admin update" on public.conversations
  for update using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = id and m.user_id = auth.uid() and m.role = 'admin'
    )
  );

-- RLS: conversation_members
drop policy if exists "conversation_members: own select" on public.conversation_members;
create policy "conversation_members: own select" on public.conversation_members
  for select using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id)
  );

drop policy if exists "conversation_members: insert self or admin" on public.conversation_members;
create policy "conversation_members: insert self or admin" on public.conversation_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversation_members m
      where m.conversation_id = conversation_id and m.user_id = auth.uid() and m.role = 'admin'
    )
  );

drop policy if exists "conversation_members: update own" on public.conversation_members;
create policy "conversation_members: update own" on public.conversation_members
  for update using (user_id = auth.uid());

-- RLS: messages
drop policy if exists "messages: members select" on public.messages;
create policy "messages: members select" on public.messages
  for select using (public.is_conversation_member(conversation_id));

drop policy if exists "messages: members insert" on public.messages;
create policy "messages: members insert" on public.messages
  for insert with check (
    auth.uid() = sender_id and public.is_conversation_member(conversation_id)
  );

drop policy if exists "messages: sender update" on public.messages;
create policy "messages: sender update" on public.messages
  for update using (
    auth.uid() = sender_id and public.is_conversation_member(conversation_id)
  );

-- RLS: reactions
drop policy if exists "message_reactions: members all" on public.message_reactions;
create policy "message_reactions: members all" on public.message_reactions
  for all using (
    exists (
      select 1 from public.messages msg
      where msg.id = message_id and public.is_conversation_member(msg.conversation_id)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages msg
      where msg.id = message_id and public.is_conversation_member(msg.conversation_id)
    )
  );

-- last_message_at を送信時に更新
create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_messages_touch_conversation on public.messages;
create trigger trg_messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

-- グループ招待コード（QR用）
create or replace function public.ensure_conversation_invite_code(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'not a member';
  end if;
  select invite_code into v_code from public.conversations where id = p_conversation_id;
  if v_code is not null then return v_code; end if;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  update public.conversations set invite_code = v_code where id = p_conversation_id;
  return v_code;
end;
$$;

grant execute on function public.ensure_conversation_invite_code(uuid) to authenticated;

create or replace function public.join_conversation_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select id into v_conv_id from public.conversations
  where invite_code = p_invite_code and type in ('group', 'project');
  if v_conv_id is null then raise exception 'invalid invite'; end if;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv_id, v_uid, 'member')
  on conflict do nothing;
  return v_conv_id;
end;
$$;

grant execute on function public.join_conversation_by_invite(text) to authenticated;

-- Realtime は apply_messages_realtime.sql を実行してください
