-- プロジェクト作成／メンバー参加の時点で、参加者全員のグループチャットを自動作成・同期する
-- Supabase SQL Editor で実行（conversations 系の適用後）

-- 1) コア: プロジェクト会話を保証し、オーナー＋全 project_members を参加させる
--    トリガーからも呼ぶため auth 不要（security definer）
create or replace function public.sync_project_group_conversation(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_name text;
  v_owner uuid;
  v_member record;
begin
  if p_project_id is null then
    raise exception 'invalid project';
  end if;

  -- メッセージ機能未適用の環境では何もしない
  if to_regclass('public.conversations') is null
     or to_regclass('public.conversation_members') is null then
    return null;
  end if;

  select p.name, p.owner_id into v_name, v_owner
  from public.projects p
  where p.id = p_project_id;

  if v_owner is null then
    raise exception 'project not found';
  end if;

  select c.id into v_conv_id
  from public.conversations c
  where c.type = 'project' and c.project_id = p_project_id
  order by c.created_at asc
  limit 1;

  if v_conv_id is null then
    insert into public.conversations (type, name, icon_emoji, project_id, created_by)
    values (
      'project',
      coalesce(nullif(trim(v_name), ''), 'プロジェクト'),
      '📁',
      p_project_id,
      v_owner
    )
    returning id into v_conv_id;
  else
    update public.conversations c
    set name = coalesce(nullif(trim(v_name), ''), c.name)
    where c.id = v_conv_id;
  end if;

  -- オーナーは常に admin
  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv_id, v_owner, 'admin')
  on conflict (conversation_id, user_id) do update
    set role = excluded.role;

  -- 全プロジェクトメンバーを同期（後から参加した人もここで入る）
  for v_member in
    select m.user_id, m.role
    from public.project_members m
    where m.project_id = p_project_id
  loop
    insert into public.conversation_members (conversation_id, user_id, role)
    values (
      v_conv_id,
      v_member.user_id,
      case when v_member.role in ('owner', 'admin') then 'admin' else 'member' end
    )
    on conflict (conversation_id, user_id) do update
      set role = excluded.role;
  end loop;

  return v_conv_id;
end;
$$;

revoke all on function public.sync_project_group_conversation(uuid) from public;
grant execute on function public.sync_project_group_conversation(uuid) to authenticated;
grant execute on function public.sync_project_group_conversation(uuid) to service_role;

-- 2) 既存 RPC: メンバー確認のうえで sync を呼ぶ
create or replace function public.get_or_create_project_conversation(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
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

  return public.sync_project_group_conversation(p_project_id);
end;
$$;

grant execute on function public.get_or_create_project_conversation(uuid) to authenticated;

-- 3) メンバー追加のたびにグループチャットへ自動同期
create or replace function public.project_members_sync_group_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_project_group_conversation(new.project_id);
  return new;
exception
  when others then
    -- 会話テーブル未適用などでもプロジェクト参加自体は成功させる
    raise warning 'project group chat sync skipped: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_project_members_sync_group_chat on public.project_members;
create trigger trg_project_members_sync_group_chat
after insert on public.project_members
for each row execute function public.project_members_sync_group_chat();

-- 4) 既存プロジェクトをバックフィル（会話が無い／メンバー欠けを修復）
do $$
declare
  r record;
begin
  if to_regclass('public.conversations') is null then
    return;
  end if;
  for r in select id from public.projects
  loop
    begin
      perform public.sync_project_group_conversation(r.id);
    exception
      when others then
        raise warning 'backfill skipped for project %: %', r.id, sqlerrm;
    end;
  end loop;
end;
$$;
