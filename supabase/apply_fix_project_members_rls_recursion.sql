-- project_members の SELECT が project_is_member() 経由で再帰し、一覧取得が失敗・タイムアウトするのを防ぐ。
-- Supabase SQL Editor でこのファイルを実行してください（何度実行しても安全）。

create or replace function public.project_is_member(p_project_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = p_uid
  );
$$;

create or replace function public.project_has_role(p_project_id uuid, p_uid uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id
      and m.user_id = p_uid
      and m.role = any (p_roles)
  );
$$;

grant execute on function public.project_is_member(uuid, uuid) to authenticated;
grant execute on function public.project_is_member(uuid, uuid) to anon;
grant execute on function public.project_has_role(uuid, uuid, text[]) to authenticated;
grant execute on function public.project_has_role(uuid, uuid, text[]) to anon;

drop policy if exists "members read project members only" on public.project_members;
create policy "members read project members only" on public.project_members for select using (
  user_id = auth.uid()
  or public.project_is_member(project_id, auth.uid())
  or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
);
