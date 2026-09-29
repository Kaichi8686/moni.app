-- プロジェクト招待を承認待ちにし、お知らせは「自分宛」だけにする
-- Run after apply_project_invite_notifications.sql
--
-- 1) project_invite_member: 即メンバー追加せず、承認待ちの招待通知を送る
-- 2) 他人の行動に関する通知（参加申請が届いた / 相手が招待を承認した等）は作らない・見せない

-- ---------------------------------------------------------------------------
-- Invite: pending notification (accept/decline via /api/projects/invite/respond)
-- ---------------------------------------------------------------------------
drop function if exists public.project_invite_member(uuid, uuid);

create or replace function public.project_invite_member(p_project_id uuid, p_invitee_id uuid)
returns public.project_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  proj public.projects;
  note public.project_notifications;
  existing public.project_notifications;
  proj_name text;
  payload text;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if p_invitee_id is null then
    raise exception 'invitee required';
  end if;
  if p_invitee_id = actor then
    raise exception 'cannot invite yourself';
  end if;

  select * into proj from public.projects where id = p_project_id;
  if proj.id is null then
    raise exception 'project not found';
  end if;

  if not public.project_has_role(p_project_id, actor, array['owner', 'admin'])
     and proj.owner_id <> actor then
    raise exception 'forbidden';
  end if;

  if exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = p_invitee_id
  ) then
    raise exception 'already a member';
  end if;

  proj_name := coalesce(nullif(btrim(proj.name), ''), 'プロジェクト');
  payload := json_build_object(
    'v', 1,
    'status', 'pending',
    'inviterId', actor,
    'projectName', proj_name,
    'message', ''
  )::text;

  -- Reuse an existing pending invite for the same project
  for existing in
    select *
    from public.project_notifications n
    where n.user_id = p_invitee_id
      and n.project_id = p_project_id
      and n.type = 'project_invite'
    order by n.created_at desc
    limit 10
  loop
    begin
      if existing.body::jsonb->>'status' = 'pending' then
        return existing;
      end if;
    exception
      when others then
        null;
    end;
  end loop;

  insert into public.project_notifications (user_id, project_id, type, body)
  values (p_invitee_id, p_project_id, 'project_invite', payload)
  returning * into note;

  return note;
end;
$$;

revoke all on function public.project_invite_member(uuid, uuid) from public;
grant execute on function public.project_invite_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Stop creating "someone else requested to join" notices for owners/admins
-- （参加申請はメンバー画面で確認。お知らせは自分宛だけ）
-- ---------------------------------------------------------------------------
drop trigger if exists trg_project_join_request_notify on public.project_join_requests;

-- ---------------------------------------------------------------------------
-- Optional: project_invites table path — no notify-to-inviter on respond
-- ---------------------------------------------------------------------------
do $outer$
begin
  if to_regclass('public.project_invites') is null then
    return;
  end if;

  execute $fn$
  create or replace function public.project_respond_invite(
    p_invite_id uuid,
    p_action text
  )
  returns public.project_invites
  language plpgsql
  security definer
  set search_path = public
  as $body$
  declare
    v_uid uuid := auth.uid();
    v_invite public.project_invites;
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

    if p_action = 'accept' then
      insert into public.project_members (project_id, user_id, role)
      values (v_invite.project_id, v_uid, 'member')
      on conflict (project_id, user_id) do nothing;

      update public.project_invites
        set status = 'accepted', resolved_at = now()
        where id = v_invite.id
        returning * into v_invite;
    else
      update public.project_invites
        set status = 'declined', resolved_at = now()
        where id = v_invite.id
        returning * into v_invite;
    end if;

    -- 招待者への結果通知は送らない（お知らせは自分に関することだけ）
    return v_invite;
  end;
  $body$;
  $fn$;

  grant execute on function public.project_respond_invite(uuid, text) to authenticated;
end;
$outer$;
