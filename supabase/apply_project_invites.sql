-- 任意: 通知ベース招待は API (/api/projects/invite) で既存 project_notifications を使うため
-- このファイルは必須ではない。専用テーブルが欲しい場合のみ実行する。
-- プロジェクト招待（URLではなくアプリ内通知で届ける）
create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (inviter_id <> invitee_id),
  unique (project_id, invitee_id)
);

create index if not exists idx_project_invites_invitee_pending
  on public.project_invites (invitee_id, created_at desc)
  where status = 'pending';

create index if not exists idx_project_invites_project
  on public.project_invites (project_id, created_at desc);

alter table public.project_invites enable row level security;

drop policy if exists "project invites read parties" on public.project_invites;
create policy "project invites read parties" on public.project_invites for select using (
  auth.uid() = inviter_id or auth.uid() = invitee_id
);

create or replace function public.project_send_invite(
  p_project_id uuid,
  p_invitee_id uuid,
  p_message text default ''
)
returns public.project_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_invite public.project_invites;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_invitee_id is null or p_invitee_id = v_uid then
    raise exception 'invalid invitee';
  end if;
  if not (
    public.project_is_member(p_project_id, v_uid)
    or exists (select 1 from public.projects p where p.id = p_project_id and p.owner_id = v_uid)
  ) then
    raise exception 'forbidden';
  end if;
  if public.project_is_member(p_project_id, p_invitee_id) then
    raise exception 'already a member';
  end if;

  select coalesce(nullif(trim(name), ''), 'プロジェクト') into v_name
  from public.projects where id = p_project_id;

  select * into v_invite
  from public.project_invites
  where project_id = p_project_id and invitee_id = p_invitee_id;

  if v_invite.id is not null then
    if v_invite.status = 'pending' then
      return v_invite;
    end if;
    update public.project_invites
      set status = 'pending',
          inviter_id = v_uid,
          message = coalesce(p_message, ''),
          created_at = now(),
          resolved_at = null
      where id = v_invite.id
      returning * into v_invite;
  else
    insert into public.project_invites (project_id, inviter_id, invitee_id, message)
    values (p_project_id, v_uid, p_invitee_id, coalesce(p_message, ''))
    returning * into v_invite;
  end if;

  insert into public.project_notifications (user_id, project_id, type, body)
  values (
    p_invitee_id,
    p_project_id,
    'project_invite',
    format('「%s」への招待が届きました。ベルから承認できます。', v_name)
  );

  return v_invite;
end;
$$;

create or replace function public.project_respond_invite(
  p_invite_id uuid,
  p_action text
)
returns public.project_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.project_invites;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_action not in ('accept', 'decline') then
    raise exception 'invalid action';
  end if;

  select * into v_invite from public.project_invites where id = p_invite_id for update;
  if v_invite.id is null then
    raise exception 'invite not found';
  end if;
  if v_invite.invitee_id <> v_uid then
    raise exception 'forbidden';
  end if;
  if v_invite.status <> 'pending' then
    raise exception 'invite already resolved';
  end if;

  select coalesce(nullif(trim(name), ''), 'プロジェクト') into v_name
  from public.projects where id = v_invite.project_id;

  if p_action = 'accept' then
    insert into public.project_members (project_id, user_id, role)
    values (v_invite.project_id, v_uid, 'member')
    on conflict (project_id, user_id) do nothing;

    update public.project_invites
      set status = 'accepted', resolved_at = now()
      where id = v_invite.id
      returning * into v_invite;

    insert into public.project_notifications (user_id, project_id, type, body)
    values (
      v_invite.inviter_id,
      v_invite.project_id,
      'project_invite_accepted',
      format('招待した相手が「%s」への参加を承認しました。', v_name)
    );
  else
    update public.project_invites
      set status = 'declined', resolved_at = now()
      where id = v_invite.id
      returning * into v_invite;

    insert into public.project_notifications (user_id, project_id, type, body)
    values (
      v_invite.inviter_id,
      v_invite.project_id,
      'project_invite_declined',
      format('招待した相手が「%s」への参加を辞退しました。', v_name)
    );
  end if;

  return v_invite;
end;
$$;

grant execute on function public.project_send_invite(uuid, uuid, text) to authenticated;
grant execute on function public.project_respond_invite(uuid, text) to authenticated;
