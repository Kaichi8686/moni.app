-- 個人がプロジェクトから脱退する（オーナーは先に権限譲渡が必要）。
-- Supabase SQL Editor で実行。

-- 会話メンバーの自己削除（脱退時のチャット掃除用フォールバック）
drop policy if exists "conversation_members: delete self" on public.conversation_members;
create policy "conversation_members: delete self" on public.conversation_members
  for delete using (user_id = auth.uid());

create or replace function public.leave_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_project_id is null then
    raise exception 'invalid_project';
  end if;

  select p.owner_id into v_owner
  from public.projects p
  where p.id = p_project_id
  for update;

  if v_owner is null then
    raise exception 'project_not_found';
  end if;

  -- オーナーが抜けるとプロジェクトが孤児になるため拒否（先に transfer_project_owner）
  if v_owner = v_uid then
    raise exception 'owner_must_transfer_first';
  end if;

  if not exists (
    select 1
    from public.project_members m
    where m.project_id = p_project_id
      and m.user_id = v_uid
  ) then
    raise exception 'not_a_member';
  end if;

  delete from public.project_members
  where project_id = p_project_id
    and user_id = v_uid;

  -- プロジェクト会話からも外す
  if to_regclass('public.conversations') is not null
     and to_regclass('public.conversation_members') is not null then
    delete from public.conversation_members cm
    using public.conversations c
    where cm.conversation_id = c.id
      and c.type = 'project'
      and c.project_id = p_project_id
      and cm.user_id = v_uid;
  end if;
end;
$$;

revoke all on function public.leave_project(uuid) from public;
grant execute on function public.leave_project(uuid) to authenticated;
