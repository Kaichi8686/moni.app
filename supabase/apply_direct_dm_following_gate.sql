-- Profile-block mail: allow 1:1 DM when the viewer follows the peer (one-way),
-- shares a project, or already has a direct conversation. Mutual follow still works
-- as a subset of following.

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

  -- Prefer an existing 1:1 so prior chats stay open even after unfollow.
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
        select 1 from public.project_members pm
        where pm.project_id = p.id and pm.user_id = v_uid
      )
    )
    and (
      p.owner_id = p_other_user_id
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = p.id and pm.user_id = p_other_user_id
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
