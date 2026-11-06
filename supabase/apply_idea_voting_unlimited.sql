-- 複数投票: 1人あたりの票数上限を実質なし（1〜9999）に拡張
-- Supabase SQL Editor で実行してください。

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in (
        'public.project_idea_events'::regclass,
        'public.project_idea_settings'::regclass
      )
      and (
        pg_get_constraintdef(oid) ilike '%votes_per_person%'
        or pg_get_constraintdef(oid) ilike '%max_votes_per_idea%'
      )
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.project_idea_events
  add constraint project_idea_events_votes_per_person_check
  check (votes_per_person between 1 and 9999);

alter table public.project_idea_events
  add constraint project_idea_events_max_votes_per_idea_check
  check (max_votes_per_idea between 1 and 9999);

alter table public.project_idea_settings
  add constraint project_idea_settings_votes_per_person_check
  check (votes_per_person between 1 and 9999);

alter table public.project_idea_settings
  add constraint project_idea_settings_max_votes_per_idea_check
  check (max_votes_per_idea between 1 and 9999);
