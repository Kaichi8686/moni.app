-- プロジェクトワークスペース内のお知らせ（投票・メンバー・募集応募・課題提出・ロードマップ達成）
-- Run after apply_projects_feature.sql
--
-- 1) メンバー向け一括通知 RPC
-- 2) メンバー追加 / 募集応募 / 投票開始・終了 / 課題提出 / ロードマップ達成のトリガー

-- ---------------------------------------------------------------------------
-- Notify project members (security definer; bypasses RLS insert)
-- ---------------------------------------------------------------------------
create or replace function public.project_notify_members(
  p_project_id uuid,
  p_type text,
  p_body text,
  p_exclude_user_id uuid default null,
  p_roles text[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  inserted integer := 0;
begin
  if p_project_id is null then
    raise exception 'project required';
  end if;
  if p_type is null or btrim(p_type) = '' then
    raise exception 'type required';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'body required';
  end if;

  -- 呼び出し元はメンバー、または応募者（募集応募通知）だけ許可
  if actor is not null then
    if not public.project_is_member(p_project_id, actor)
       and not exists (
         select 1
         from public.project_recruitment_applications a
         where a.project_id = p_project_id
           and a.applicant_id = actor
           and a.status = 'pending'
       )
       and not exists (
         select 1
         from public.project_join_requests r
         where r.project_id = p_project_id
           and r.requester_id = actor
           and r.status = 'pending'
       )
       and not exists (
         select 1 from public.projects p
         where p.id = p_project_id and p.owner_id = actor
       )
    then
      raise exception 'forbidden';
    end if;
  end if;

  insert into public.project_notifications (user_id, project_id, type, body)
  select m.user_id, p_project_id, p_type, left(btrim(p_body), 500)
  from public.project_members m
  where m.project_id = p_project_id
    and (p_exclude_user_id is null or m.user_id <> p_exclude_user_id)
    and (p_roles is null or m.role = any (p_roles));

  get diagnostics inserted = row_count;

  -- owner_id フォールバック（members 行が無いオーナー）
  if p_roles is null or 'owner' = any (p_roles) then
    insert into public.project_notifications (user_id, project_id, type, body)
    select p.owner_id, p_project_id, p_type, left(btrim(p_body), 500)
    from public.projects p
    where p.id = p_project_id
      and (p_exclude_user_id is null or p.owner_id <> p_exclude_user_id)
      and not exists (
        select 1 from public.project_members m
        where m.project_id = p.id and m.user_id = p.owner_id
      );
    if found then
      inserted := inserted + 1;
    end if;
  end if;

  return inserted;
end;
$$;

revoke all on function public.project_notify_members(uuid, text, text, uuid, text[]) from public;
grant execute on function public.project_notify_members(uuid, text, text, uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- member_added
-- ---------------------------------------------------------------------------
create or replace function public.project_notify_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_label text;
  proj_name text;
begin
  select coalesce(nullif(btrim(pr.display_name), ''), 'ユーザー')
    into member_label
  from public.profiles pr
  where pr.id = new.user_id;
  if member_label is null then
    member_label := 'ユーザー';
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'プロジェクト')
    into proj_name
  from public.projects p
  where p.id = new.project_id;

  begin
    perform public.project_notify_members(
      new.project_id,
      'member_added',
      format('%s さんが「%s」に参加しました。', member_label, coalesce(proj_name, 'プロジェクト')),
      new.user_id,
      null
    );
  exception
    when others then
      null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_project_notify_member_added on public.project_members;
create trigger trg_project_notify_member_added
after insert on public.project_members
for each row execute function public.project_notify_member_added();

-- ---------------------------------------------------------------------------
-- recruitment_applied（募集への応募）
-- ---------------------------------------------------------------------------
create or replace function public.project_notify_recruitment_applied()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_label text;
  proj_name text;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select coalesce(nullif(btrim(pr.display_name), ''), 'ユーザー')
    into applicant_label
  from public.profiles pr
  where pr.id = new.applicant_id;
  if applicant_label is null then
    applicant_label := 'ユーザー';
  end if;

  select coalesce(nullif(btrim(p.name), ''), 'プロジェクト')
    into proj_name
  from public.projects p
  where p.id = new.project_id;

  begin
    perform public.project_notify_members(
      new.project_id,
      'recruitment_applied',
      format('%s さんが「%s」の募集に応募しました。', applicant_label, coalesce(proj_name, 'プロジェクト')),
      new.applicant_id,
      array['owner', 'admin']::text[]
    );
  exception
    when others then
      null;
  end;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.project_recruitment_applications') is null then
    return;
  end if;
  drop trigger if exists trg_project_notify_recruitment_applied on public.project_recruitment_applications;
  create trigger trg_project_notify_recruitment_applied
  after insert on public.project_recruitment_applications
  for each row execute function public.project_notify_recruitment_applied();
end $$;

-- 投票・課題・ロードマップはクライアントから project_notify_members を呼ぶ
-- （tasks フォールバックや packed description 経路でも漏れないようにする）

create index if not exists idx_project_notifications_user_project_unread
  on public.project_notifications (user_id, project_id, created_at desc)
  where read_at is null;

