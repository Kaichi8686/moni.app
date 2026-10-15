-- Mutual-follow gate for direct (1:1) mail + optional durable follow notices.
-- Run in Supabase SQL Editor after follows / follow_requests / conversations exist.
-- App UI also builds follow notices from live follows + follow_requests (works without this file).

-- ---------------------------------------------------------------------------
-- Optional: durable social notifications (trigger-backed)
-- ---------------------------------------------------------------------------
create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('follow', 'follow_request')),
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists social_notifications_user_created_idx
  on public.social_notifications (user_id, created_at desc);

create index if not exists social_notifications_user_unread_idx
  on public.social_notifications (user_id)
  where read_at is null;

alter table public.social_notifications enable row level security;

drop policy if exists "social_notifications select own" on public.social_notifications;
create policy "social_notifications select own" on public.social_notifications
  for select using (auth.uid() = user_id);

drop policy if exists "social_notifications update own" on public.social_notifications;
create policy "social_notifications update own" on public.social_notifications
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "social_notifications delete own" on public.social_notifications;
create policy "social_notifications delete own" on public.social_notifications
  for delete using (auth.uid() = user_id);

create or replace function public.notify_social_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_label text;
  notify_body text;
begin
  if new.follower_id is null or new.following_id is null then
    return new;
  end if;
  if new.follower_id = new.following_id then
    return new;
  end if;

  -- Private-account path already notified via follow_request; skip duplicate.
  if exists (
    select 1
    from public.follow_requests fr
    where fr.follower_id = new.follower_id
      and fr.following_id = new.following_id
  ) then
    return new;
  end if;

  select coalesce(nullif(btrim(p.display_name), ''), 'ユーザー')
    into actor_label
  from public.profiles p
  where p.id = new.follower_id;

  if actor_label is null then
    actor_label := 'ユーザー';
  end if;

  notify_body := format('%s さんにフォローされました', actor_label);

  insert into public.social_notifications (user_id, actor_id, type, body)
  values (new.following_id, new.follower_id, 'follow', notify_body);

  return new;
end;
$$;

drop trigger if exists trg_notify_social_follow on public.follows;
create trigger trg_notify_social_follow
after insert on public.follows
for each row execute function public.notify_social_follow();

create or replace function public.notify_social_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_label text;
  notify_body text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;
  if new.follower_id is null or new.following_id is null then
    return new;
  end if;
  if new.follower_id = new.following_id then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from 'pending' then
    return new;
  end if;

  select coalesce(nullif(btrim(p.display_name), ''), 'ユーザー')
    into actor_label
  from public.profiles p
  where p.id = new.follower_id;

  if actor_label is null then
    actor_label := 'ユーザー';
  end if;

  notify_body := format('%s さんからフォローリクエストが届きました', actor_label);

  insert into public.social_notifications (user_id, actor_id, type, body)
  values (new.following_id, new.follower_id, 'follow_request', notify_body);

  return new;
end;
$$;

drop trigger if exists trg_notify_social_follow_request_ins on public.follow_requests;
create trigger trg_notify_social_follow_request_ins
after insert on public.follow_requests
for each row execute function public.notify_social_follow_request();

drop trigger if exists trg_notify_social_follow_request_upd on public.follow_requests;
create trigger trg_notify_social_follow_request_upd
after update of status on public.follow_requests
for each row execute function public.notify_social_follow_request();

-- ---------------------------------------------------------------------------
-- Mutual-follow gate for direct (1:1) mail conversations
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_mutual boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception 'invalid peer';
  end if;

  select exists (
    select 1 from public.follows f1
    where f1.follower_id = v_uid and f1.following_id = p_other_user_id
  ) and exists (
    select 1 from public.follows f2
    where f2.follower_id = p_other_user_id and f2.following_id = v_uid
  ) into v_mutual;

  if not coalesce(v_mutual, false) then
    select exists (
      select 1
      from public.projects p
      where (
        p.owner_id = v_uid
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id and m.user_id = v_uid
        )
      )
      and (
        p.owner_id = p_other_user_id
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id and m.user_id = p_other_user_id
        )
      )
    ) into v_mutual;
  end if;

  if not coalesce(v_mutual, false) then
    raise exception 'mutual follow required';
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
