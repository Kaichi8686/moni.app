-- プロジェクト・グループ会話の取得／作成（メールタブ用）
-- Supabase SQL Editor で実行

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

  if v_conv_id is not null then
    insert into public.conversation_members (conversation_id, user_id, role)
    values (v_conv_id, v_uid, 'member')
    on conflict do nothing;
    return v_conv_id;
  end if;

  select name into v_name from public.projects where id = p_project_id;

  insert into public.conversations (type, name, icon_emoji, project_id, created_by)
  values ('project', coalesce(nullif(trim(v_name), ''), 'プロジェクト'), '📁', p_project_id, v_uid)
  returning id into v_conv_id;

  -- オーナー + メンバーを全員参加させる
  insert into public.conversation_members (conversation_id, user_id, role)
  select v_conv_id, p.owner_id,
    case when p.owner_id = v_uid then 'admin' else 'member' end
  from public.projects p
  where p.id = p_project_id
  on conflict do nothing;

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

create or replace function public.create_group_conversation(
  p_name text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conv_id uuid;
  v_mid uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.conversations (type, name, icon_emoji, created_by)
  values (
    'group',
    coalesce(nullif(trim(p_name), ''), 'グループ'),
    '💬',
    v_uid
  )
  returning id into v_conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv_id, v_uid, 'admin');

  if p_member_ids is not null then
    foreach v_mid in array p_member_ids
    loop
      if v_mid is null or v_mid = v_uid then
        continue;
      end if;
      insert into public.conversation_members (conversation_id, user_id, role)
      values (v_conv_id, v_mid, 'member')
      on conflict do nothing;
    end loop;
  end if;

  return v_conv_id;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
