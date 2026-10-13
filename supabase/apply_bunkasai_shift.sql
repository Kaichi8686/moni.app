-- 文化祭シンプルシフト（認証なし・同じURLで27人が選ぶ）
-- Supabase SQL Editor でこのファイルを実行してください。

create table if not exists public.bunkasai_signups (
  id uuid primary key default gen_random_uuid(),
  slot_id text not null check (slot_id in ('slot1', 'slot2', 'slot3', 'slot4')),
  member_token text not null unique,
  member_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bunkasai_signups_slot
  on public.bunkasai_signups (slot_id);

create or replace function public.bunkasai_enforce_capacity()
returns trigger
language plpgsql
as $$
declare
  cnt integer;
  next_num integer;
begin
  -- 定員9人（更新で枠を移す場合は、自分自身を除いて数える）
  select count(*)::integer into cnt
  from public.bunkasai_signups
  where slot_id = new.slot_id
    and (tg_op = 'INSERT' or id is distinct from new.id);

  if cnt >= 9 then
    raise exception 'SLOT_FULL' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' and (new.member_number is null or new.member_number <= 0) then
    select coalesce(max(member_number), 0) + 1 into next_num
    from public.bunkasai_signups;
    new.member_number := next_num;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bunkasai_capacity on public.bunkasai_signups;
create trigger trg_bunkasai_capacity
  before insert or update of slot_id on public.bunkasai_signups
  for each row
  execute function public.bunkasai_enforce_capacity();

alter table public.bunkasai_signups enable row level security;

drop policy if exists "bunkasai public select" on public.bunkasai_signups;
create policy "bunkasai public select"
  on public.bunkasai_signups for select
  using (true);

drop policy if exists "bunkasai public insert" on public.bunkasai_signups;
create policy "bunkasai public insert"
  on public.bunkasai_signups for insert
  with check (true);

drop policy if exists "bunkasai public update" on public.bunkasai_signups;
create policy "bunkasai public update"
  on public.bunkasai_signups for update
  using (true)
  with check (true);

drop policy if exists "bunkasai public delete" on public.bunkasai_signups;
create policy "bunkasai public delete"
  on public.bunkasai_signups for delete
  using (true);

-- Realtime（既に入っている場合はエラーを無視してOK）
do $$
begin
  alter publication supabase_realtime add table public.bunkasai_signups;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
