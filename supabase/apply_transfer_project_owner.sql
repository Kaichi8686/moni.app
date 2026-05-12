-- Atomically transfer project ownership (UI + backend must agree). SECURITY DEFINER bypasses RLS safely after checks.
create or replace function public.transfer_project_owner(p_project_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select p.owner_id into v_old_owner
  from public.projects p
  where p.id = p_project_id
  for update;

  if v_old_owner is null then
    raise exception 'project_not_found';
  end if;

  if v_old_owner <> auth.uid() then
    raise exception 'only_current_owner';
  end if;

  if p_new_owner_id = auth.uid() then
    raise exception 'already_owner';
  end if;

  if not exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = p_new_owner_id
  ) then
    raise exception 'new_owner_must_be_member';
  end if;

  update public.projects
  set owner_id = p_new_owner_id,
      updated_at = now()
  where id = p_project_id;

  update public.project_members
  set role = 'admin'
  where project_id = p_project_id and user_id = v_old_owner;

  update public.project_members
  set role = 'owner'
  where project_id = p_project_id and user_id = p_new_owner_id;
end;
$$;

revoke all on function public.transfer_project_owner(uuid, uuid) from public;
grant execute on function public.transfer_project_owner(uuid, uuid) to authenticated;
