-- project_members の SELECT ポリシーが project_is_member() を呼ぶ → 関数内が再度 project_members を読み
-- RLS が再帰 → 「stack depth limit exceeded」になる。
-- メンバー判定は SECURITY DEFINER + row_security off で RLS を迂回し、再帰のみ止める。

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
