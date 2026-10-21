-- プロジェクトグループラインの全員同期 + プロジェクト仲間同士の 1:1 DM
-- Supabase SQL Editor で実行

-- 1) プロジェクト会話: 既存でも毎回メンバーを全員同期
create or replace function public.get_or_create_project_conversation(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_name text;
  v_member record;
  v_is_member boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_project_id is null then
    raise exception 'invalid project';
  end if;

  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        p.owner_id = v_uid
        or exists (
          select 1 from public.project_members m
          where m.project_id = p.id and m.user_id = v_uid
        )
      )
  ) into v_is_member;

  if not v_is_member then
    raise exception 'not a project member';
  end if;

  select c.id into v_conv_id
  from public.conversations c
  where c.type = 'project' and c.project_id = p_project_id
  order by c.created_at asc
  limit 1;

  if v_conv_id is null then
    select name into v_name from public.projects where id = p_project_id;

    insert into public.conversations (type, name, icon_emoji, project_id, created_by)
    values ('project', coalesce(nullif(trim(v_name), ''), 'プロジェクト'), '📁', p_project_id, v_uid)
    returning id into v_conv_id;
  else
    -- プロジェクト名が変わっていれば会話名も合わせる
    update public.conversations c
    set name = coalesce(nullif(trim(p.name), ''), c.name)
    from public.projects p
    where c.id = v_conv_id and p.id = p_project_id;
  end if;

  -- オーナーを参加させる
  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conv_id, p.owner_id,
    case when p.owner_id = v_uid then 'admin' else 'member' end
  from public.projects p
  where p.id = p_project_id
  on conflict do nothing;

  -- 全プロジェクトメンバーを参加させる（後から参加した人も同期）
  for v_member in
    select user_id from public.project_members where project_id = p_project_id
  loop
    insert into public.conversation_members (conversation_id, user_id, role)
    values (
      v_conv_id,
      v_member.user_id,
      case when v_member.user_id = v_uid then 'admin' else 'member' end
    )
    on conflict do nothing;
  end loop;

  return v_conv_id;
end;
$$;

grant execute on function public.get_or_create_project_conversation(uuid) to authenticated;

-- 2) 1:1: 相互フォロー または 同じプロジェクトに所属していれば作成可
-- Keep in sync with apply_direct_dm_following_gate.sql (one-way follow OK).
create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_following boolean;
  v_project_peer boolean;
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

  select exists (
    select 1 from public.follows f
    where f.follower_id = v_uid and f.following_id = p_other_user_id
  ) into v_following;

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
  ) into v_project_peer;

  if not coalesce(v_following, false) and not coalesce(v_project_peer, false) then
    raise exception 'mutual follow required';
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
