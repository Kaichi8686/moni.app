-- 予定の種別: event=通常, busy=忙しい日（課題の期限を置かない）
-- Supabase SQL Editor で実行してください。

alter table public.project_schedules
  add column if not exists kind text not null default 'event';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_schedules_kind_check'
  ) then
    alter table public.project_schedules
      add constraint project_schedules_kind_check
      check (kind in ('event', 'busy'));
  end if;
end $$;

comment on column public.project_schedules.kind is
  'event: 通常の予定 / busy: 忙しい日（課題期限を割り当てない）';
