-- アプリ全体の運営管理者（profiles.role = 'admin'）
-- Supabase SQL Editor で実行してください。

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('child', 'parent', 'investor', 'admin'));

create or replace function public.is_app_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_uid
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_app_admin(uuid) from public;
grant execute on function public.is_app_admin(uuid) to authenticated;

-- 初期管理者（既に登録済みのアカウントに付与）
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('kigyouman8686@gmail.com');
