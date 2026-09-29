-- プロジェクト招待の承認・辞退結果を招待者へお知らせする
-- Run after apply_project_invite_notifications.sql
--
-- 1) project_invite_member: 即メンバー追加せず、承認待ちの招待通知を送る
-- 2) （任意）project_invites テーブル経由の応答でも招待者名付きで通知

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
-- Optional: project_invites table path — notify inviter with invitee name
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
    v_name text;
    v_invitee_label text;
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

    select coalesce(nullif(btrim(pr.display_name), ''), 'ユーザー')
      into v_invitee_label
    from public.profiles pr
    where pr.id = v_uid;
    if v_invitee_label is null then
      v_invitee_label := 'ユーザー';
    end if;

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
        format('%s さんが「%s」への招待を承認しました。', v_invitee_label, v_name)
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
        format('%s さんが「%s」への招待を拒否しました。', v_invitee_label, v_name)
      );
    end if;

    return v_invite;
  end;
  $body$;
  $fn$;

  grant execute on function public.project_respond_invite(uuid, text) to authenticated;
end;
$outer$;
