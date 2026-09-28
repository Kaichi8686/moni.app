-- Project invite / join-request notifications
-- Run after apply_projects_feature.sql
--
-- 1) 参加申請が届いたらオーナー・管理者へお知らせ
-- 2) メンバー招待 RPC（招待された側へお知らせ）
-- 3) 参加申請の承認・拒否メッセージにプロジェクト名を含める

-- ---------------------------------------------------------------------------
-- Helper: notify project owners/admins about a new join request
-- ---------------------------------------------------------------------------
create or replace function public.project_notify_join_request_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proj_name text;
  requester_label text;
  notify_body text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'プロジェクト')
    into proj_name
  from public.projects p
  where p.id = new.project_id;

  select coalesce(nullif(btrim(pr.display_name), ''), 'ユーザー')
    into requester_label
  from public.profiles pr
  where pr.id = new.requester_id;

  if requester_label is null then
    requester_label := 'ユーザー';
  end if;

  notify_body := format('%s さんから「%s」への参加申請が届きました。', requester_label, coalesce(proj_name, 'プロジェクト'));

  insert into public.project_notifications (user_id, project_id, type, body)
  select m.user_id, new.project_id, 'join_request_received', notify_body
  from public.project_members m
  where m.project_id = new.project_id
    and m.role in ('owner', 'admin')
    and m.user_id <> new.requester_id;

  -- Fallback: owner_id on projects if members row is missing
  insert into public.project_notifications (user_id, project_id, type, body)
  select p.owner_id, new.project_id, 'join_request_received', notify_body
  from public.projects p
  where p.id = new.project_id
    and p.owner_id <> new.requester_id
    and not exists (
      select 1
      from public.project_members m
      where m.project_id = p.id
        and m.user_id = p.owner_id
        and m.role in ('owner', 'admin')
    );

  return new;
end;
$$;

drop trigger if exists trg_project_join_request_notify on public.project_join_requests;
create trigger trg_project_join_request_notify
after insert on public.project_join_requests
for each row execute function public.project_notify_join_request_received();

-- ---------------------------------------------------------------------------
-- Invite a user as member (owner/admin only) + notify invitee
-- ---------------------------------------------------------------------------
create or replace function public.project_invite_member(p_project_id uuid, p_invitee_id uuid)
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  proj public.projects;
  mem public.project_members;
  inviter_label text;
  proj_name text;
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

  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, p_invitee_id, 'member')
  on conflict (project_id, user_id) do nothing
  returning * into mem;

  if mem.user_id is null then
    select * into mem from public.project_members
    where project_id = p_project_id and user_id = p_invitee_id;
  end if;

  select coalesce(nullif(btrim(pr.display_name), ''), 'ユーザー')
    into inviter_label
  from public.profiles pr
  where pr.id = actor;
  if inviter_label is null then
    inviter_label := 'ユーザー';
  end if;

  proj_name := coalesce(nullif(btrim(proj.name), ''), 'プロジェクト');

  insert into public.project_notifications (user_id, project_id, type, body)
  values (
    p_invitee_id,
    p_project_id,
    'project_invited',
    format('%s さんから「%s」に招待されました。', inviter_label, proj_name)
  );

  return mem;
end;
$$;

revoke all on function public.project_invite_member(uuid, uuid) from public;
grant execute on function public.project_invite_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Improve accept/reject notification copy (include project name)
-- ---------------------------------------------------------------------------
create or replace function public.project_review_join_request(p_request_id uuid, p_action text)
returns public.project_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.project_join_requests;
  proj_name text;
begin
  select * into req from public.project_join_requests r where r.id = p_request_id for update;
  if req.id is null then
    raise exception 'request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'request already reviewed';
  end if;
  if not public.project_has_role(req.project_id, auth.uid(), array['owner','admin']) then
    raise exception 'forbidden';
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'プロジェクト')
    into proj_name
  from public.projects p
  where p.id = req.project_id;

  if p_action = 'accept' then
    insert into public.project_members (project_id, user_id, role)
    values (req.project_id, req.requester_id, 'member')
    on conflict (project_id, user_id) do nothing;

    update public.project_join_requests
      set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
      where id = req.id
      returning * into req;
  elsif p_action = 'reject' then
    update public.project_join_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where id = req.id
      returning * into req;
  else
    raise exception 'invalid action';
  end if;

  insert into public.project_notifications (user_id, project_id, type, body)
  values (
    req.requester_id,
    req.project_id,
    case when p_action = 'accept' then 'join_request_accepted' else 'join_request_rejected' end,
    case
      when p_action = 'accept' then format('「%s」への参加申請が承認されました。', coalesce(proj_name, 'プロジェクト'))
      else format('「%s」への参加申請が却下されました。', coalesce(proj_name, 'プロジェクト'))
    end
  );

  return req;
end;
$$;

-- Index for unread inbox queries
create index if not exists idx_project_notifications_user_unread
  on public.project_notifications (user_id, created_at desc)
  where read_at is null;
